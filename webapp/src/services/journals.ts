import { supabase } from '../lib/supabaseClient';

export type JournalItem = {
  id: string;
  verse_id: string | null;
  reference: string | null;
  author_id: string;
  is_me: boolean;
  visibility: 'private' | 'group' | string;
  created_at: string;
  observation_text: string | null;
  application_text: string | null;
  prayer_text: string | null;
};

export async function listGroupJournals(groupId: string): Promise<JournalItem[]> {
  const { data, error } = await supabase.rpc('list_group_journals', { p_group_id: groupId });
  if (error) throw new Error(error.message);
  return (data ?? []) as JournalItem[];
}
