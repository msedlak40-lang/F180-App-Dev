import { supabase } from '../lib/supabaseClient';

export type MyCollection = {
  id: string;
  name: string;
  icon: string;
  item_count: number;
};

export async function bookmarkVerse(verseId: string) {
  const { error } = await supabase.rpc('bookmark_verse', { p_verse_id: verseId });
  if (error) throw new Error(error.message);
}

export async function unbookmarkVerse(verseId: string) {
  const { error } = await supabase.rpc('unbookmark_verse', { p_verse_id: verseId });
  if (error) throw new Error(error.message);
}

/** Returns the subset of verseIds that I have bookmarked */
export async function listMyBookmarksForVerses(verseIds: string[]) {
  if (verseIds.length === 0) return [] as string[];
  const { data, error } = await supabase.rpc('list_my_bookmarks_for_verses', {
    p_verse_ids: verseIds,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { verse_id: string }) => r.verse_id) as string[];
}

export async function listMyCollections(): Promise<MyCollection[]> {
  const { data, error } = await supabase.rpc('list_my_collections');
  if (error) throw new Error(error.message);
  return (data ?? []) as MyCollection[];
}

export async function createCollection(name: string, icon?: string) {
  const { data, error } = await supabase.rpc('create_collection', {
    p_name: name,
    p_icon: icon ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string; // new collection id
}

export async function addToCollection(collectionId: string, verseId: string) {
  const { error } = await supabase.rpc('add_to_collection', {
    p_collection_id: collectionId,
    p_verse_id: verseId,
  });
  if (error) throw new Error(error.message);
}

export async function removeFromCollection(collectionId: string, verseId: string) {
  const { error } = await supabase.rpc('remove_from_collection', {
    p_collection_id: collectionId,
    p_verse_id: verseId,
  });
  if (error) throw new Error(error.message);
}

export async function addMyTag(verseId: string, tag: string) {
  const { error } = await supabase.rpc('add_my_tag', {
    p_verse_id: verseId,
    p_tag: tag,
  });
  if (error) throw new Error(error.message);
}

export async function removeMyTag(verseId: string, tag: string) {
  const { error } = await supabase.rpc('remove_my_tag', {
    p_verse_id: verseId,
    p_tag: tag,
  });
  if (error) throw new Error(error.message);
}

export async function listMyTagsForVerses(verseIds: string[]) {
  if (!verseIds.length) return {} as Record<string, string[]>;
  const { data, error } = await supabase.rpc('list_my_tags_for_verses', {
    p_verse_ids: verseIds,
  });
  if (error) throw new Error(error.message);
  const map: Record<string, string[]> = {};
  (data ?? []).forEach((r: { verse_id: string; tags: string[] }) => {
    map[r.verse_id] = r.tags ?? [];
  });
  return map;
}

