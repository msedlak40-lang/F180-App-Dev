// webapp/src/services/accountability.ts
import { supabase } from '../lib/supabaseClient';

export type InboxItem = {
  item_id: string;
  created_at: string;
  member_id: string;
  member_name: string;
  title: string | null;
  content: string;
  status: 'new' | 'seen' | 'responded' | 'archived';
};

export async function listLeaderInbox(groupId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase.rpc('ai_list_inbox', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxItem[];
}

export async function ackItem(itemId: string, ack: 'saw_it' | 'praying', message?: string) {
  const { error } = await supabase.rpc('ai_ack', {
    p_item_id: itemId,
    p_ack: ack,
    p_message: message ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function replyItem(itemId: string, message: string) {
  const { error } = await supabase.rpc('ai_ack', {
    p_item_id: itemId,
    p_ack: 'replied',
    p_message: message,
  });
  if (error) throw new Error(error.message);
}
// add this to the bottom (and export it)
export async function shareSoapApplication(
  groupId: string,
  applicationText: string,
  journalId?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('ai_add_item', {
    p_group_id: groupId,
    p_source_type: 'soap',
    p_source_id: journalId ?? null,
    p_title: 'Application (I Will)',
    p_content: applicationText,
    p_visibility: 'leader',
  });
  if (error) throw new Error(error.message);
  return data as string; // accountability_items.id
}
