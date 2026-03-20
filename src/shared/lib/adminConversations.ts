/** @file
 * Admin conversations domain service for staff conversation search/detail API.
 * 入力: 検索パラメータ（email/from/to/keyword/page/limit）or 会話 ID。
 * 出力: ページング済み会話一覧 or 会話詳細（メッセージ＋添付）。
 * 依存: Supabase Service Role クライアント、AppError。
 * セキュリティ: requireStaff() で認可済みの呼び出しのみ想定。
 * 最適化: ページネーション・メッセージ数集計はサーバーサイド（select count + range）。
 */

import type { Database } from '../types/database'

import { AppError } from './errors'
import { getSupabaseAdminClient } from './supabaseAdmin'

type ConversationRow = Database['public']['Tables']['conversations']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']
type AttachmentRow = Database['public']['Tables']['attachments']['Row']
type AppUserRow = Database['public']['Tables']['app_user']['Row']

export type ListConversationsParams = {
  email?: string
  from?: string
  to?: string
  keyword?: string
  page: number
  limit: number
}

type ConversationListItem = {
  id: string
  title: string
  createdAt: string
  messageCount: number
  user: {
    email: string
    displayName: string | null
  }
}

type PaginationInfo = {
  page: number
  limit: number
  total: number
  totalPages: number
}

type ListConversationsResult = {
  conversations: ConversationListItem[]
  pagination: PaginationInfo
}

type MessageDetail = {
  id: string
  role: string
  content: string
  createdAt: string
  attachments: {
    id: string
    storagePath: string
    mimeType: string | null
    sizeBytes: number | null
  }[]
}

type ConversationDetailResult = {
  id: string
  title: string
  createdAt: string
  user: {
    email: string
    displayName: string | null
  }
  messages: MessageDetail[]
}

export async function listConversations(
  params: ListConversationsParams,
): Promise<ListConversationsResult> {
  const supabase = getSupabaseAdminClient()
  const { email, from, to, keyword, page, limit } = params

  // Step 1: email filter → resolve user_ids
  let filteredUserIds: string[] | null = null
  if (email) {
    const { data: users } = await supabase
      .from('app_user')
      .select()
      .ilike('email', `%${email}%`)

    if (!users || users.length === 0) {
      return {
        conversations: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }
    }
    filteredUserIds = (users as AppUserRow[]).map((u) => u.auth_uid)
  }

  // Step 2: build conversations query with filters + server-side pagination
  const offset = (page - 1) * limit
  let query = supabase.from('conversations').select('*', { count: 'exact' })

  if (filteredUserIds) {
    query = query.in('user_id', filteredUserIds)
  }

  if (keyword) {
    query = query.ilike('title', `%${keyword}%`)
  }

  if (from) {
    query = query.gte('created_at', from)
  }

  if (to) {
    // "to" is inclusive — add 1 day
    const toDate = new Date(to)
    toDate.setUTCDate(toDate.getUTCDate() + 1)
    const toExclusive = toDate.toISOString().split('T')[0]
    query = query.lt('created_at', toExclusive)
  }

  query = query.order('created_at', { ascending: false })
  query = query.range(offset, offset + limit - 1)

  const { data: paged, count: totalCount } = await query

  const total = totalCount ?? 0
  const totalPages = Math.ceil(total / limit)

  if (!paged || paged.length === 0) {
    return {
      conversations: [],
      pagination: { page, limit, total, totalPages },
    }
  }

  // Step 3: count messages per conversation (server-side HEAD count)
  const pagedConvs = paged as ConversationRow[]
  const convIds = pagedConvs.map((c) => c.id)
  const messageCountMap = new Map<string, number>()
  await Promise.all(
    convIds.map(async (convId) => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convId)
      messageCountMap.set(convId, count ?? 0)
    }),
  )

  // Step 4: resolve user info
  const userIds = [...new Set(pagedConvs.map((c) => c.user_id))]
  const { data: users } = await supabase.from('app_user').select().in('auth_uid', userIds)

  const userMap = new Map<string, AppUserRow>()
  for (const u of (users as AppUserRow[]) ?? []) {
    userMap.set(u.auth_uid, u)
  }

  // Step 5: assemble response
  const conversations: ConversationListItem[] = pagedConvs.map((c) => {
    const user = userMap.get(c.user_id)
    return {
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      messageCount: messageCountMap.get(c.id) ?? 0,
      user: {
        email: user?.email ?? 'unknown',
        displayName: user?.display_name ?? null,
      },
    }
  })

  return {
    conversations,
    pagination: { page, limit, total, totalPages },
  }
}

export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetailResult> {
  const supabase = getSupabaseAdminClient()

  // Step 1: fetch conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select()
    .eq('id', conversationId)
    .single()

  if (convError || !conversation) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', '会話が見つかりません。')
  }

  const conv = conversation as ConversationRow

  // Step 2: fetch user
  const { data: user } = await supabase
    .from('app_user')
    .select()
    .eq('auth_uid', conv.user_id)
    .single()

  const appUser = user as AppUserRow | null

  // Step 3: fetch messages (ascending)
  const { data: messages } = await supabase
    .from('messages')
    .select()
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const msgs = (messages as MessageRow[]) ?? []

  // Step 4: fetch attachments for these messages
  const messageIds = msgs.map((m) => m.id)
  const attachmentsByMsgId = new Map<string, AttachmentRow[]>()

  if (messageIds.length > 0) {
    const { data: attachments } = await supabase
      .from('attachments')
      .select()
      .in('message_id', messageIds)

    for (const att of (attachments as AttachmentRow[]) ?? []) {
      const existing = attachmentsByMsgId.get(att.message_id) ?? []
      existing.push(att)
      attachmentsByMsgId.set(att.message_id, existing)
    }
  }

  return {
    id: conv.id,
    title: conv.title,
    createdAt: conv.created_at,
    user: {
      email: appUser?.email ?? 'unknown',
      displayName: appUser?.display_name ?? null,
    },
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      attachments: (attachmentsByMsgId.get(m.id) ?? []).map((a) => ({
        id: a.id,
        storagePath: a.storage_path,
        mimeType: a.mime_type,
        sizeBytes: a.size_bytes,
      })),
    })),
  }
}
