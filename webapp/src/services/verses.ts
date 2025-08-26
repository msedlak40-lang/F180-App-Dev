import { supabase } from '../lib/supabaseClient';

/** Server shape for a verse row (incl. new fields) */
export type GroupVerse = {
  id: string;
  group_id: string;
  reference: string;
  version: string | null;
  verse_text: string | null;
  testament: 'old' | 'new' | null;
  status: 'pending' | 'enriching' | 'enriched' | 'error';
  error_message?: string | null;

  author_name?: string | null;
  author_role?: string | null;
  setting_context?: string | null;
  simplified_5th?: string | null;
  book_context_summary?: string | null;
  classification?: string | null;
  tags: string[]; // auto-tags from enrichment
  hebrew_keywords?: string[] | null;
  greek_keywords?: string[] | null;

  // 4C additions
  heart_snapshot?: string | null;
  emotional_climate?: string[] | null;
  then_now_bridge?: string | null;
  cross_references?: string[] | null;
};

/** Create a verse for a group (notes optional, currently ignored) */
export async function createGroupVerse(
  groupId: string,
  reference: string,
  version?: string,
  _notes?: string
) {
  const { data, error } = await supabase.rpc('add_group_verse', {
    p_group_id: groupId,
    p_reference: reference.trim(),
    p_version: version?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as string; // new verse id
}

/** List verses for a group (includes all enrichment fields) */
export async function listGroupVerses(groupId: string): Promise<GroupVerse[]> {
  const { data, error } = await supabase
    .from('group_verses')
    .select(`
      id, group_id, reference, version, verse_text, testament, status, error_message,
      author_name, author_role, setting_context, simplified_5th, book_context_summary, classification,
      tags, hebrew_keywords, greek_keywords,
      heart_snapshot, emotional_climate, then_now_bridge, cross_references
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as GroupVerse[];
}

/** Call the Edge Function to enrich a verse */
export async function enrichVerse(verseId: string) {
  const { data: session } = await supabase.auth.getSession();
  const access_token = session?.session?.access_token;
  if (!access_token) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-verse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${access_token}`,
      apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY),
    },
    body: JSON.stringify({ verse_id: verseId }),
  });

  if (!res.ok) {
    // try to surface the function's JSON error
    let msg = `Edge Function error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      const t = await res.text().catch(() => '');
      if (t) msg = t;
    }
    throw new Error(msg);
  }
  return res.json();
}

/** SOAP journaling */
export type JournalVisibility = 'private' | 'group';

export async function saveSoapEntry(
  groupId: string,
  verseId: string,
  visibility: JournalVisibility,
  observation: string,
  application: string,
  prayer: string
) {
  const { data, error } = await supabase.rpc('save_soap_entry', {
    p_group_id: groupId,
    p_verse_id: verseId,
    p_visibility: visibility,
    p_observation: observation,
    p_application: application,
    p_prayer: prayer,
  });
  if (error) throw new Error(error.message);
  return data as string; // journal_id
}

/** Optional helper: fetch journals tied to a verse (you + group-visible) */
export async function listJournalsForVerse(groupId: string, verseId: string) {
  const { data, error } = await supabase
    .from('journals')
    .select(
      'id, author_id, visibility, observation_text, application_text, prayer_text, created_at'
    )
    .eq('group_id', groupId)
    .eq('verse_id', verseId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
