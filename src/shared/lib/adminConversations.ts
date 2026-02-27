/** @file
 * Admin conversations domain service for staff conversation search/detail API.
 * 入力: 検索パラメータ（email/from/to/keyword/page/limit）or 会話 ID。
 * 出力: ページング済み会話一覧 or 会話詳細（メッセージ＋添付）。
 * 依存: Supabase Service Role クライアント、AppError。
 * セキュリティ: requireStaff() で認可済みの呼び出しのみ想定。
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
    filteredUserIds = (users as AppUserRow[]).map((u) => u.id)
  }

  // Step 2: build conversations query with filters
  let query = supabase.from('conversations').select()

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

  const { data: allConversations } = await query

  if (!allConversations || allConversations.length === 0) {
    return {
      conversations: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    }
  }

  // Step 3: paginate in JS
  const total = allConversations.length
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const paged = (allConversations as ConversationRow[]).slice(offset, offset + limit)

  if (paged.length === 0) {
    return {
      conversations: [],
      pagination: { page, limit, total, totalPages },
    }
  }

  // Step 4: count messages per conversation
  const convIds = paged.map((c) => c.id)
  const { data: messages } = await supabase
    .from('messages')
    .select()
    .in('conversation_id', convIds)

  const messageCountMap = new Map<string, number>()
  for (const msg of (messages as MessageRow[]) ?? []) {
    messageCountMap.set(msg.conversation_id, (messageCountMap.get(msg.conversation_id) ?? 0) + 1)
  }

  // Step 5: resolve user info
  const userIds = [...new Set(paged.map((c) => c.user_id))]
  const { data: users } = await supabase.from('app_user').select().in('id', userIds)

  const userMap = new Map<string, AppUserRow>()
  for (const u of (users as AppUserRow[]) ?? []) {
    userMap.set(u.id, u)
  }

  // Step 6: assemble response
  const conversations: ConversationListItem[] = paged.map((c) => {
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
    .eq('id', conv.user_id)
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
