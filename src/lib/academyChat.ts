import { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';

const academy = () => supabase.schema('academy');

/**
 * An owner has no member row of their own, so before they can take part in a
 * conversation the database gives them one of kind 'staff', enrolled in the
 * academy they run. Everything downstream — RLS, the conversation functions,
 * notifications — then treats them like any other participant.
 *
 * Safe to call repeatedly: it returns the existing row after the first time,
 * and null if the caller does not own that academy.
 */
export async function ensureStaffMember(academyId: string): Promise<string | null> {
  const { data } = await academy().rpc('ensure_staff_member', {
    target_academy_id: academyId,
  });

  return (data as string) ?? null;
}

export type Conversation = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  image_url: string | null;
  academy_id: string | null;
  /** The member who leads a group: they alone rename it or change its picture. */
  created_by: string | null;
  for_member_id: string;
  for_member_name: string;
  other_names: string[];
  other_avatar: string | null;
  last_body: string | null;
  last_at: string | null;
  unread_count: number;
  /** Total messages ever sent, so an unused group can be left out of a list. */
  message_count: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ChatPerson = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  member_kind: 'guardian' | 'player' | 'staff';
  academy_name: string;
};

export async function fetchConversations(): Promise<Conversation[]> {
  const { data } = await academy().rpc('my_conversations');
  return (data ?? []) as Conversation[];
}

/** Everyone at the academies this owner runs: their parents and their players. */
export async function fetchAcademyPeople(): Promise<ChatPerson[]> {
  const { data } = await academy().rpc('my_teammates');

  return ((data ?? []) as ChatPerson[]).filter((person) => person.member_kind !== 'staff');
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data } = await academy()
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300);

  return (data ?? []) as ChatMessage[];
}

/** Names for the senders in a thread, so each bubble can be labelled. */
export async function fetchAuthors(
  memberIds: string[]
): Promise<Record<string, { id: string; full_name: string }>> {
  if (memberIds.length === 0) return {};

  const { data } = await academy().from('members').select('id, full_name').in('id', memberIds);

  return Object.fromEntries(
    ((data ?? []) as { id: string; full_name: string }[]).map((row) => [row.id, row])
  );
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  return academy()
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() });
}

/**
 * Starting a chat goes through the database rather than an insert here: the
 * rule that both sides must share an academy lives in the function, where a
 * crafted request cannot step around it.
 */
export async function startDirectChat(
  asMemberId: string,
  otherMemberId: string
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await academy().rpc('start_direct_conversation', {
    as_member_id: asMemberId,
    other_member_id: otherMemberId,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

/**
 * `reuseExisting` is for the roster shortcuts: "Message all parents" is a
 * standing group, not a new one each time the owner presses it.
 */
export async function createGroupChat(
  asMemberId: string,
  title: string,
  memberIds: string[],
  reuseExisting = false
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await academy().rpc('create_group_conversation', {
    as_member_id: asMemberId,
    group_title: title,
    member_ids: memberIds,
    reuse_existing: reuseExisting,
  });

  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

export async function markConversationRead(asMemberId: string, conversationId: string) {
  return academy().rpc('mark_conversation_read', {
    as_member_id: asMemberId,
    target_conversation_id: conversationId,
  });
}

/**
 * Live messages for one thread. Realtime cannot evaluate the RLS-derived
 * "conversations I am in" rule as a filter, so this subscribes by conversation
 * id, which it can filter on directly.
 */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`owner-chat-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'academy',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as ChatMessage)
    )
    .subscribe();
}

/**
 * One row per conversation, rather than one per member of a family who is
 * in it. The database answers honestly with all of them; a list shows each
 * thread once, with the unread counts added up.
 */
export function collapseToOnePerConversation(rows: Conversation[]): Conversation[] {
  const byId = new Map<string, Conversation>();

  for (const row of rows) {
    const existing = byId.get(row.id);

    if (!existing) {
      byId.set(row.id, { ...row });
      continue;
    }

    byId.set(row.id, {
      ...existing,
      unread_count: existing.unread_count + row.unread_count,
    });
  }

  return [...byId.values()];
}

export async function updateGroup(input: {
  conversationId: string;
  title?: string | null;
  imageUrl?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await academy().rpc('update_group', {
    target_conversation_id: input.conversationId,
    new_title: input.title ?? null,
    new_image_url: input.imageUrl ?? null,
  });

  return { error: error?.message ?? null };
}

export async function transferGroupLeadership(
  conversationId: string,
  newLeaderMemberId: string
): Promise<{ error: string | null }> {
  const { error } = await academy().rpc('transfer_group_leadership', {
    target_conversation_id: conversationId,
    new_leader_member_id: newLeaderMemberId,
  });

  return { error: error?.message ?? null };
}

export async function deleteGroup(conversationId: string): Promise<{ error: string | null }> {
  const { error } = await academy().rpc('delete_group', {
    target_conversation_id: conversationId,
  });

  return { error: error?.message ?? null };
}

/** Who is in a group, so its leader can hand it on. */
export async function fetchGroupMembers(
  conversationId: string
): Promise<{ id: string; full_name: string }[]> {
  const { data } = await academy()
    .from('conversation_members')
    .select('member_id')
    .eq('conversation_id', conversationId);

  const ids = ((data ?? []) as { member_id: string }[]).map((row) => row.member_id);
  if (ids.length === 0) return [];

  return Object.values(await fetchAuthors(ids));
}
