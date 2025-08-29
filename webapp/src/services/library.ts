// webapp/src/services/library.ts
import { supabase } from '../lib/supabaseClient';

/* ───────────────────────────────────────────────────────────────
   Collections
──────────────────────────────────────────────────────────────── */

export type MyCollection = {
  id: string;
  name: string;
  item_count: number;
  updated_at: string;
};

export async function listMyCollections(): Promise<MyCollection[]> {
  const { data, error } = await supabase.rpc('list_my_collections', {});
  if (error) throw new Error(error.message);
  return (data ?? []) as MyCollection[];
}

export type CollectionVerseItem = {
  id: string;            // collection_items.id
  verse_id: string;      // group_verses.id
  reference: string;
  version: string | null;
  group_id: string;
  created_at: string;    // when added to the collection
};

export async function listMyCollectionVerses(collectionId: string): Promise<CollectionVerseItem[]> {
  // Prefer RPC if present
  const { data, error } = await supabase.rpc('list_my_collection_verses', {
    p_collection_id: collectionId,
  });
  if (!error && Array.isArray(data)) {
    return data as CollectionVerseItem[];
  }

  // Fallback (requires RLS to allow selection)
  const { data: rows, error: e2 } = await supabase
    .from('collection_items')
    .select(
      `
      id,
      created_at,
      ref_id,
      verse:group_verses!inner (
        id,
        reference,
        version,
        group_id
      )
    `
    )
    .eq('collection_id', collectionId)
    .eq('ref_type', 'verse')
    .order('created_at', { ascending: false });

  if (e2) throw new Error(e2.message);

  return (rows ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    verse_id: r.verse?.id,
    reference: r.verse?.reference,
    version: r.verse?.version ?? null,
    group_id: r.verse?.group_id,
  })) as CollectionVerseItem[];
}

/** Add a verse to a specific collection (RPC preferred; fallback insert). */
export async function addVerseToCollection(collectionId: string, verseId: string): Promise<void> {
  const { error } = await supabase.rpc('add_verse_to_my_collection', {
    p_collection_id: collectionId,
    p_verse_id: verseId,
  });

  if (!error) return;

  // Fallback direct insert (ensure your table & RLS rules match these columns)
  const { error: e2 } = await supabase.from('collection_items').insert({
    collection_id: collectionId,
    ref_type: 'verse',
    ref_id: verseId,
  });
  if (e2) throw new Error(e2.message);
}

/** Remove a single item row from a collection by its collection_items.id. */
export async function removeCollectionItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('collection_items') // or 'user_collection_items' if that’s your table
    .delete()
    .eq('id', itemId);

  if (error) throw new Error(error.message);
}

// Back-compat alias some UIs import
export async function deleteCollectionItem(itemId: string): Promise<void> {
  return removeCollectionItem(itemId);
}

/* ───────────────────────────────────────────────────────────────
   Starred Verses
──────────────────────────────────────────────────────────────── */

export type StarredVerse = {
  id: string;           // bookmark row id
  verse_id: string;
  group_id: string;
  reference: string;
  version: string | null;
  created_at: string;
};

export async function listStarredVerses(): Promise<StarredVerse[]> {
  // Try RPC if present
  const rpc = await supabase.rpc('list_my_starred_verses', {});
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data as StarredVerse[];
  }

  // Fallback join: verse_bookmarks → group_verses
  const { data, error } = await supabase
    .from('verse_bookmarks')
    .select(
      `
      id,
      created_at,
      verse_id,
      verse:group_verses!inner (
        id,
        reference,
        version,
        group_id
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    verse_id: r.verse?.id ?? r.verse_id,
    group_id: r.verse?.group_id,
    reference: r.verse?.reference,
    version: r.verse?.version ?? null,
  })) as StarredVerse[];
}

/** Star a verse (ignores duplicate/unique errors for smooth UX). */
export async function starVerse(verseId: string): Promise<void> {
  const { error } = await supabase.from('verse_bookmarks').insert({ verse_id: verseId });
  if (error && !/duplicate|unique|already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

/** Unstar a verse for the current user. */
export async function unstarVerse(verseId: string): Promise<void> {
  const { error } = await supabase.from('verse_bookmarks').delete().eq('verse_id', verseId);
  if (error) throw new Error(error.message);
}

// Back-compat alias some UIs import
export async function listMyStarredVerses(): Promise<StarredVerse[]> {
  return listStarredVerses();
}

/* ───────────────────────────────────────────────────────────────
   Devotion Highlights
──────────────────────────────────────────────────────────────── */

export type DevotionHighlightItem = {
  id: string;
  devotion_id: string;
  group_id: string;
  devotion_title: string;
  text: string;
  note: string | null;
  created_at: string;
};

export async function listDevotionHighlights(): Promise<DevotionHighlightItem[]> {
  const { data, error } = await supabase.rpc('dev_list_my_highlights', {});
  if (error) throw new Error(error.message);
  return (data ?? []) as DevotionHighlightItem[];
}

// Back-compat alias some UIs import
export async function listMyDevHighlights(): Promise<DevotionHighlightItem[]> {
  return listDevotionHighlights();
}

/* ───────────────────────────────────────────────────────────────
   Study Highlights
──────────────────────────────────────────────────────────────── */

export type StudyHighlightItem = {
  id: string;
  entry_id: string;
  series_id: string;
  group_id: string;
  series_title: string;
  entry_title: string;
  text: string;
  note: string | null;
  created_at: string;
};

export async function listMyStudyHighlights(): Promise<StudyHighlightItem[]> {
  const { data, error } = await supabase.rpc('sg_list_my_highlights', {});
  if (error) throw new Error(error.message);
  return (data ?? []) as StudyHighlightItem[];
}

/* ───────────────────────────────────────────────────────────────
   Deep-link helpers
──────────────────────────────────────────────────────────────── */

/** Verses tab, optionally focused on a verse. */
export function buildVerseHref(groupId: string, verseId?: string): string {
  const q = new URLSearchParams();
  if (verseId) q.set('verse', verseId);
  const qs = q.toString();
  return `#/group/${groupId}/verses${qs ? `?${qs}` : ''}`;
}

/** Devotions tab focused on a specific devotion (adjust param if your DevotionsTab expects another key). */
export function buildDevotionHref(groupId: string, devotionId: string): string {
  const q = new URLSearchParams();
  q.set('devotion', devotionId);
  return `#/group/${groupId}/devotions?${q.toString()}`;
}

/** Study tab focused on a series/entry. */
export function buildStudyHref(groupId: string, seriesId: string, entryId?: string): string {
  const q = new URLSearchParams();
  q.set('series', seriesId);
  if (entryId) q.set('entry', entryId);
  return `#/group/${groupId}/study?${q.toString()}`;
}
