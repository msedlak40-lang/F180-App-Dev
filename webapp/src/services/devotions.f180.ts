// src/services/devotions.f180.ts (adds day_index and aliases position:day_index)
// Preview-only overlay for Devotions (keeps live services/devotions.ts untouched)
import { supabase } from "../lib/supabaseClient";
export * from "./devotions"; // re-export everything you already have

type DevEntry = {
  id: string;
  series_id: string | null;
  title?: string | null;
  body_md?: string | null;
  scheduled_date?: string | null;
  day_index?: number | null;
  position?: number | null; // alias for day_index to match any UI sorts
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw error ?? new Error("Not authenticated");
  return data.user.id;
}

/** Study-style: toggleBookmarkEntry(entryId, on) */
export async function toggleBookmarkEntry(entryId: string, on: boolean) {
  const uid = await requireUid();
  const eid = String(entryId);
  if (on) {
    const { error } = await supabase
      .from("devotion_entry_bookmarks")
      .upsert({ user_id: uid, entry_id: eid }, { onConflict: "user_id,entry_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("devotion_entry_bookmarks")
      .delete()
      .eq("user_id", uid)
      .eq("entry_id", eid);
    if (error) throw error;
  }
  return { ok: true };
}

/** Study-style: toggleArchiveEntry({ entryId, archived }) */
export async function toggleArchiveEntry(arg1: any, arg2?: any) {
  const eid = typeof arg1 === "object" ? String(arg1?.entryId ?? "") : String(arg1);
  const archived = typeof arg1 === "object" ? !!arg1?.archived : !!arg2;
  if (!eid) throw new Error("entryId required");

  const uid = await requireUid();
  if (archived) {
    const { error } = await supabase
      .from("devotion_entry_archives")
      .upsert(
        { user_id: uid, entry_id: eid, archived_at: new Date().toISOString() },
        { onConflict: "user_id,entry_id" }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("devotion_entry_archives")
      .delete()
      .eq("user_id", uid)
      .eq("entry_id", eid);
    if (error) throw error;
  }
  return { ok: true };
}

/** Rail dots: which entries are bookmarked/archived */
export async function listFlagsForEntries(entryIds: string[]): Promise<{ bookmarked: string[]; archived: string[] }> {
  const ids = (entryIds || []).map(String).filter(Boolean);
  if (ids.length === 0) return { bookmarked: [], archived: [] };

  const { data: bRows, error: bErr } = await supabase
    .from("devotion_entry_bookmarks")
    .select("entry_id")
    .in("entry_id", ids);
  if (bErr) throw bErr;

  const { data: aRows, error: aErr } = await supabase
    .from("devotion_entry_archives")
    .select("entry_id")
    .in("entry_id", ids);
  if (aErr) throw aErr;

  return {
    bookmarked: (bRows ?? []).map((r: any) => String(r.entry_id)),
    archived: (aRows ?? []).map((r: any) => String(r.entry_id)),
  };
}

/** Study-style “mine” lists (used by Bookmarks/Archived tabs) */
export async function listMyBookmarkedEntries(): Promise<{ bySeries: Record<string, DevEntry[]>; ids: string[] }> {
  const uid = await requireUid();
  const { data: bRows, error: bErr } = await supabase
    .from("devotion_entry_bookmarks")
    .select("entry_id")
    .eq("user_id", uid);
  if (bErr) throw bErr;

  const ids = (bRows ?? []).map((r: any) => String(r.entry_id));
  if (ids.length === 0) return { bySeries: {}, ids: [] };

  const { data: entries, error: eErr } = await supabase
    .from("devotion_entries")
    .select("id, series_id, title, body_md, scheduled_date, day_index, position:day_index")
    .in("id", ids);
  if (eErr) throw eErr;

  const bySeries: Record<string, DevEntry[]> = {};
  for (const e of entries ?? []) {
    const sid = String((e as any).series_id ?? "");
    if (!sid) continue;
    (bySeries[sid] ||= []).push(e as DevEntry);
  }
  return { bySeries, ids };
}

export async function listMyArchivedEntries(): Promise<{ bySeries: Record<string, DevEntry[]>; ids: string[] }> {
  const uid = await requireUid();
  const { data: aRows, error: aErr } = await supabase
    .from("devotion_entry_archives")
    .select("entry_id")
    .eq("user_id", uid);
  if (aErr) throw aErr;

  const ids = (aRows ?? []).map((r: any) => String(r.entry_id));
  if (ids.length === 0) return { bySeries: {}, ids: [] };

  const { data: entries, error: eErr } = await supabase
    .from("devotion_entries")
    .select("id, series_id, title, body_md, scheduled_date, day_index, position:day_index")
    .in("id", ids);
  if (eErr) throw eErr;

  const bySeries: Record<string, DevEntry[]> = {};
  for (const e of entries ?? []) {
    const sid = String((e as any).series_id ?? "");
    if (!sid) continue;
    (bySeries[sid] ||= []).push(e as DevEntry);
  }
  return { bySeries, ids };
}
