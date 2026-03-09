/** @file
 * `/api/chat` Route Handler
 * 機能：チャットメッセージを受信し、AIからの応答をストリーミングで返す。
 *   添付画像がある場合は attachments テーブルにも永続化する。
 *   分間レート制限（10 req/min）と月間クォータ（100 問/月）を適用。
 *   添付枚数（3枚）・メッセージ文字数（2000文字）のサーバーサイドバリデーション。
 *   会話保存後に LLM（gpt-4o-mini）で20文字以内のタイトルを非同期生成。
 * 入力：JSON { messages: UIMessage[], attachments?: { storagePath, mimeType, size }[] }
 * 出力：Streaming Text Response
 * 依存：Vercel AI SDK, OpenAI, Supabase Auth, rateLimit
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
    const conversationId = crypto.randomUUID()

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
      model: openai('gpt-4o-mini'), // コストが安くて高速なモデルを指定
      system: 'あなたは親切で分かりやすい塾の先生です。中高生の学習をサポートしてください。数式は必ずLaTeX形式($...$ または $$...$$)で記述してください。角括弧 [] や [ ] は数式デリミタとして使用しないでください。', // AIへの「役割」指示
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

          // conversations を作成
          await supabaseAdmin.from('conversations').insert({
            id: conversationId,
            user_id: user.id,
            title: makeTitle(),
          })

          // 最新のユーザーメッセージ + AI 応答を保存
          const userMessageId = crypto.randomUUID()
          const rows: { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string }[] = []
          if (userText) {
            rows.push({
              id: userMessageId,
              conversation_id: conversationId,
              role: 'user' as const,
              content: userText,
            })
          }
          rows.push({
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'assistant' as const,
            content: assistantText,
          })
          await supabaseAdmin.from('messages').insert(rows)

          // 添付画像がある場合は attachments テーブルに保存
          if (attachmentInputs.length > 0 && userText) {
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

          // LLM でタイトルを非同期生成（失敗しても既存タイトルが残る）
          if (userText && assistantText) {
            void (async () => {
              try {
                const titleResult = await generateText({
                  model: openai('gpt-4o-mini'),
                  prompt: `以下のユーザーの質問とAIの回答から、20文字以内の短い会話タイトルを生成してください。タイトルのみを出力してください。\nユーザー: ${userText.slice(0, 200)}\nAI: ${assistantText.slice(0, 200)}`,
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
