import { supabase } from '../lib/supabaseClient';

export type PrayerVisibility = 'private' | 'leaders' | 'group';

export type PrayerItem = {
  id: string;
  verse_id: string | null;
  reference: string | null;
  author_id: string;
  is_me: boolean;
  visibility: PrayerVisibility;
  created_at: string;
  prayer_text: string;
  comments_count: number;
};

export type PrayerComment = {
  id: string;
  author_id: string;
  is_me: boolean;
  body_text: string;
  created_at: string;
};

export async function createPrayer(
  groupId: string,
  prayerText: string,
  visibility: PrayerVisibility,
  verseId?: string | null
) {
  const { data, error } = await supabase.rpc('create_prayer', {
    p_group_id: groupId,
    p_prayer: prayerText,
    p_visibility: visibility,
    p_verse_id: verseId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string; // new prayer id
}

export async function listGroupPrayers(groupId: string): Promise<PrayerItem[]> {
  const { data, error } = await supabase.rpc('list_group_prayers', {
    p_group_id: groupId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PrayerItem[];
}

export async function listPrayerComments(prayerId: string, limit = 50): Promise<PrayerComment[]> {
  const { data, error } = await supabase.rpc('list_prayer_comments', {
    p_prayer_id: prayerId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PrayerComment[];
}

export async function addPrayerComment(prayerId: string, body: string) {
  const { data, error } = await supabase.rpc('add_prayer_comment', {
    p_prayer_id: prayerId,
    p_body: body,
  });
  if (error) throw new Error(error.message);
  return data as string; // new comment id
}

export async function updatePrayer(
  prayerId: string,
  updates: { text?: string; visibility?: PrayerVisibility; verseId?: string | null }
) {
  const args: any = { p_prayer_id: prayerId };
  if (updates.text !== undefined) args.p_text = updates.text;
  if (updates.visibility !== undefined) args.p_visibility = updates.visibility;
  if (updates.verseId !== undefined) args.p_verse_id = updates.verseId; // null = clear, omit = keep
  const { error } = await supabase.rpc('update_prayer', args);
  if (error) throw new Error(error.message);
}

export async function deletePrayer(prayerId: string) {
  const { error } = await supabase.rpc('delete_prayer', { p_prayer_id: prayerId });
  if (error) throw new Error(error.message);
}
