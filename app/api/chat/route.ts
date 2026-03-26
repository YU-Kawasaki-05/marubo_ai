/** @file
 * `/api/chat` Route Handler
 * 機能：チャットメッセージを受信し、AIからの応答をストリーミングで返す。
 *   添付画像がある場合は Storage の署名 URL を生成し、AI に ImagePart として渡す（Vision 入力）。
 *   添付画像は attachments テーブルにも永続化する（テキストなし＋画像のみの送信にも対応）。
 *   分間レート制限（10 req/min）と月間クォータ（100 問/月）を適用。
 *   添付枚数（3枚）・メッセージ文字数（2000文字）のサーバーサイドバリデーション。
 *   会話保存後に LLM（CHAT_LLM_MODEL 環境変数、デフォルト gpt-4o-mini）で20文字以内のタイトルを非同期生成。
 * 入力：JSON { messages: UIMessage[], attachments?: { storagePath, mimeType, size }[], conversationId?: string }
 * 出力：Streaming Text Response
 * 依存：Vercel AI SDK, OpenAI, Supabase Auth/Storage, rateLimit
 * セキュリティ：ログイン済みユーザーのみ実行可能。レート制限で過剰利用を防止。
 */

import { openai } from '@ai-sdk/openai'
import { createClient } from '@supabase/supabase-js'
import { generateText, streamText, type UIMessage } from 'ai'

import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_MESSAGE_LENGTH } from '@shared/lib/attachmentValidation'
import { AppError } from '@shared/lib/errors'
import { notifyError } from '@shared/lib/notifier'
import { checkMinuteRate, checkMonthlyQuota, incrementUsage, resolveAppUserId } from '@shared/lib/rateLimit'
import { getSupabaseAdminClient } from '@shared/lib/supabaseAdmin'
import type { Database } from '@shared/types/database'
import { convertSafeMessages } from '@shared/utils/ai-message-converter'

// Next.jsのEdge Runtimeではなく、互換性重視でNode.js Runtimeを使用
export const runtime = 'nodejs'

// チャット用 LLM モデル名（環境変数で切り替え可能）
const CHAT_MODEL = process.env.CHAT_LLM_MODEL ?? 'gpt-4o-mini'

// 環境変数からSupabase接続情報を作成
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type UIMessageWithLegacyContent = UIMessage & { content?: string }

/** クライアントから送られる添付メタデータ（署名 URL アップロード済み） */
type AttachmentInput = {
  storagePath: string
  mimeType?: string
  size?: number
}

const getUIMessageText = (message?: UIMessageWithLegacyContent) => {
  if (!message) return ''
  if (typeof message.content === 'string' && message.content.length > 0) {
    return message.content
  }
  return message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('')
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response('Missing OPENAI_API_KEY environment variable', { status: 500 })
  }

  try {
    // 1. 認証チェック: ログインしているユーザーか確認する
    // クライアントから送られてきた認証トークンを取り出す
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized: No Authorization header', { status: 401 })
    }

    // Supabaseを使ってトークンが本物か検証する
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (error || !user) {
      return new Response('Unauthorized: Invalid token', { status: 401 })
    }

    // 2. レート制限チェック（分間 + 月間クォータ）
    const appUserId = await resolveAppUserId(user.id)
    await checkMinuteRate(appUserId)
    await checkMonthlyQuota(appUserId)

    // 3. ユーザーからのメッセージデータを受け取る
    // クライアント(useChat)から送られるメッセージは UI Message 形式なので、
    // 自作の Adapter 関数を使って安全に Model Message 形式に変換する。
    const requestBody = (await req.json()) as {
      messages?: UIMessageWithLegacyContent[]
      attachments?: AttachmentInput[]
      conversationId?: string
    }
    const uiMessages = requestBody.messages ?? []
    const attachmentInputs = requestBody.attachments ?? []

    // 添付枚数バリデーション
    if (attachmentInputs.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return new Response(
        JSON.stringify({ error: `添付画像は${MAX_ATTACHMENTS_PER_MESSAGE}枚までです` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // メッセージ文字数バリデーション
    const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === 'user')
    const userTextForValidation = getUIMessageText(lastUserMsg)
    if (userTextForValidation && userTextForValidation.length > MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: `メッセージが長すぎます（${MAX_MESSAGE_LENGTH}文字以内）` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const messages = await convertSafeMessages(uiMessages)

    const supabaseAdmin = getSupabaseAdminClient()

    // 添付画像の署名 URL を取得（AI Vision 入力用）
    let imageUrls: { url: string; mimeType: string }[] = []
    if (attachmentInputs.length > 0) {
      const signResults = await Promise.all(
        attachmentInputs.map(async (a) => {
          try {
            const { data } = await supabaseAdmin.storage
              .from('attachments')
              .createSignedUrl(a.storagePath, 600) // 10分有効
            return {
              url: data?.signedUrl ?? null,
              mimeType: a.mimeType ?? 'image/jpeg',
            }
          } catch {
            console.error(`Failed to create signed URL for ${a.storagePath}`)
            return { url: null, mimeType: a.mimeType ?? 'image/jpeg' }
          }
        }),
      )
      imageUrls = signResults.filter(
        (r): r is { url: string; mimeType: string } => r.url !== null,
      )
    }

    // 最後の user メッセージに ImagePart を追加（gpt-4o-mini Vision 入力）
    if (imageUrls.length > 0) {
      let lastUserIndex = -1
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') { lastUserIndex = i; break }
      }
      if (lastUserIndex >= 0) {
        const userMsg = messages[lastUserIndex]
        const textParts: Array<{ type: 'text'; text: string }> =
          typeof userMsg.content === 'string'
            ? [{ type: 'text', text: userMsg.content }]
            : Array.isArray(userMsg.content)
              ? userMsg.content
                  .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              : []
        const imageParts: Array<{ type: 'image'; image: URL; mimeType: string }> =
          imageUrls.map((img) => ({
            type: 'image' as const,
            image: new URL(img.url),
            mimeType: img.mimeType,
          }))
        messages[lastUserIndex] = {
          ...userMsg,
          content: [...textParts, ...imageParts],
        } as (typeof messages)[number]
      }
    }

    const isNewConversation = !requestBody.conversationId
    const conversationId = requestBody.conversationId ?? crypto.randomUUID()

    // 既存会話への追記時: オーナーチェック（他人の会話への追記を防止）
    if (!isNewConversation) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .single()
      if (!conv || conv.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: '会話が見つかりません' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    const lastUserMessage = [...uiMessages]
      .reverse()
      .find((m) => m.role === 'user')

    const userText = getUIMessageText(lastUserMessage)

    const makeTitle = () => {
      if (userText && userText.trim().length > 0) {
        return userText.trim().slice(0, 50)
      }
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes(),
      ).padStart(2, '0')}`
    }

    // 4. AI（OpenAI）に応答を生成させる
    // streamText関数を使うと、AIの回答を少しずつ（ストリーミング）返せる
    const result = await streamText({
      model: openai(CHAT_MODEL),
      system: 'あなたは親切で分かりやすい塾の先生です。中高生の学習をサポートしてください。数式は必ずLaTeX形式($...$ または $$...$$)で記述してください。角括弧 [] や [ ] は数式デリミタとして使用しないでください。画像が添付されている場合は、画像の内容を確認して回答に反映してください。教科書の写真や問題用紙の場合は、写っている問題を読み取って解説してください。', // AIへの「役割」指示
      messages, // ModelMessage[]
      // 必要があればここに temperature (創造性) などを設定可能
      onFinish: async (event) => {
        try {
          const assistantText =
            (event.text as string | undefined) ??
            ((event as Record<string, unknown>).responseMessages as Array<{ parts?: Array<{ type: string; text?: string }> }> | undefined)
              ?.flatMap((m) =>
                m.parts?.filter((p) => p.type === 'text').map((p) => p.text ?? '') ?? [],
              )
              .join('') ??
            ''

          // 新規会話のみ conversations を作成（既存会話への追記時はスキップ）
          if (isNewConversation) {
            await supabaseAdmin.from('conversations').insert({
              id: conversationId,
              user_id: user.id,
              title: makeTitle(),
            })
          }

          // 最新のユーザーメッセージ + AI 応答を保存
          // 個別 INSERT で seq（BIGSERIAL）の採番順を保証する
          // テキストまたは添付がある場合にユーザーメッセージを保存
          // 画像のみ送信時は content が空文字になるが、
          // attachments テーブルとの紐付けのためにレコードは必要
          const hasUserContent = userText || attachmentInputs.length > 0
          const userMessageId = crypto.randomUUID()
          if (hasUserContent) {
            await supabaseAdmin.from('messages').insert({
              id: userMessageId,
              conversation_id: conversationId,
              role: 'user' as const,
              content: userText || '',
            })
          }
          await supabaseAdmin.from('messages').insert({
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'assistant' as const,
            content: assistantText,
          })

          // 添付画像がある場合は attachments テーブルに保存
          if (attachmentInputs.length > 0) {
            const attachmentRows = attachmentInputs.map((a) => ({
              id: crypto.randomUUID(),
              message_id: userMessageId,
              user_id: user.id,
              storage_path: a.storagePath,
              mime_type: a.mimeType ?? null,
              size_bytes: a.size ?? null,
            }))
            await supabaseAdmin.from('attachments').insert(attachmentRows)
          }

          // 利用カウンタを +1（月間クォータ管理用）
          await incrementUsage(appUserId)

          // LLM でタイトルを非同期生成（新規会話のみ。失敗しても既存タイトルが残る）
          if (isNewConversation && hasUserContent && assistantText) {
            void (async () => {
              try {
                const titlePromptContext = userText
                  ? `ユーザー: ${userText.slice(0, 200)}\nAI: ${assistantText.slice(0, 200)}`
                  : `AI: ${assistantText.slice(0, 200)}`
                const titleResult = await generateText({
                  model: openai(CHAT_MODEL),
                  prompt: `以下のユーザーの質問とAIの回答から、20文字以内の短い会話タイトルを生成してください。タイトルのみを出力してください。\n${titlePromptContext}`,
                })
                const generatedTitle = titleResult.text.trim().slice(0, 20)
                if (generatedTitle) {
                  await supabaseAdmin
                    .from('conversations')
                    .update({ title: generatedTitle })
                    .eq('id', conversationId)
                }
              } catch (titleError) {
                console.error('Title generation error:', titleError)
              }
            })()
          }
        } catch (saveError) {
          console.error('Chat save error:', saveError)
          // 保存失敗はレスポンスには影響させない（ログのみ）
        }
      },
    })

    // 5. ストリーミング形式でレスポンスを返す（conversationId をヘッダで返す）
    const response = result.toUIMessageStreamResponse()
    const headers = new Headers(response.headers)
    headers.set('x-conversation-id', conversationId)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (err) {
    // レート制限 / クォータ超過 → 429
    if (err instanceof AppError && err.status === 429) {
      void notifyError('S2', 'レート制限発動', `${err.code}: ${err.message}`)
      return new Response(JSON.stringify({ error: err.message }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ユーザー解決失敗 → 403
    if (err instanceof AppError && err.status === 403) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.error('Chat API Error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown Error'
    void notifyError('S1', 'LLM 全経路失敗', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
