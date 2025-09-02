import React from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  createPrayer,
  listGroupPrayers,
  listPrayerComments,
  addPrayerComment,
  updatePrayer,
  deletePrayer,
  type PrayerItem,
  type PrayerVisibility,
} from "../../services/prayers";
import { listGroupVerses, type GroupVerse } from "../../services/verses";
import { useF180Toast } from "../../components/f180/F180ToastProvider";

/** Marker used in prayer_text to identify the hidden chat anchor row */
const CHAT_ANCHOR_PREFIX = "::chat-anchor::";

/* ---------- Small UI bits ---------- */
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5 shadow-sm">
      {children}
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[hsl(var(--muted-foreground))]">{children}</span>;
}
function VisibilityBadge({ v }: { v: PrayerVisibility }) {
  const label = v === "group" ? "Group" : v === "leaders" ? "Leaders" : "Private";
  const classes =
    v === "group"
      ? "bg-blue-500/10 text-blue-200 border-blue-500/30"
      : v === "leaders"
      ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
      : "bg-white/10 text-white/80 border-white/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${classes}`}>
      {label}
    </span>
  );
}

/* ---------- Reusable comments list (per-prayer) ---------- */
function Comments({ prayerId }: { prayerId: string }) {
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof listPrayerComments>>>([]);
  const [val, setVal] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const rows = await listPrayerComments(prayerId, 200);
      setItems(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerId]);

  const send = async () => {
    const t = val.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await addPrayerComment(prayerId, t);
      setVal("");
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed to add comment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--popover))]">
      <div className="max-h-64 overflow-auto p-3 space-y-2">
        {loading && <div className="text-sm opacity-70">Loading…</div>}
        {err && <div className="text-sm text-red-300">{err}</div>}
        {!loading && !err && items.length === 0 && (
          <div className="text-sm opacity-70">No comments yet.</div>
        )}
        {items.map((c) => (
          <div key={c.id} className={`text-sm ${c.is_me ? "text-right" : "text-left"}`}>
            <span
              className={`inline-block rounded-lg border px-2 py-1 ${
                c.is_me
                  ? "bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
                  : "bg-[hsl(var(--muted))] border-[hsl(var(--border))]"
              }`}
            >
              {c.body_text}
            </span>
            <div className="mt-0.5 text-[11px] opacity-60">
              {new Date(c.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[hsl(var(--border))] p-2 flex items-center gap-2">
        <input
          className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none"
          placeholder="Write a comment…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
        />
        <button
          className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-60"
          onClick={send}
          disabled={busy || !val.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* ---------- Community Chat: comments on hidden anchor prayer (prayer_text startsWith "::chat-anchor::") ---------- */
function CommunityChatCard({ groupId }: { groupId: string }) {
  const [anchorId, setAnchorId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof listPrayerComments>>>([]);
  const [val, setVal] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const meRef = React.useRef<string | null>(null);

  // Ensure an anchor prayer exists (prayer_text LIKE '::chat-anchor::%')
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        meRef.current = auth.user?.id ?? null;

        const found = await supabase
          .from("group_prayers")
          .select("id,prayer_text")
          .eq("group_id", groupId)
          .like("prayer_text", `${CHAT_ANCHOR_PREFIX}%`)
          .limit(1)
          .maybeSingle();

        if (found.data?.id) {
          setAnchorId(found.data.id);
        } else {
          // create anchor with a deterministic marker for this group
          const anchorText = `${CHAT_ANCHOR_PREFIX}${groupId}`;
          const insert = await supabase
            .from("group_prayers")
            .insert({
              group_id: groupId,
              author_id: meRef.current,
              prayer_text: anchorText,
              visibility: "group",
              created_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (insert.data?.id) setAnchorId(insert.data.id);
          else throw insert.error || new Error("Failed to create chat anchor");
        }
      } catch (e: any) {
        setErr(e?.message ?? "Couldn’t initialize chat");
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  // Load messages (comments on anchor)
  const load = React.useCallback(async () => {
    if (!anchorId) return;
    try {
      const rows = await listPrayerComments(anchorId, 200);
      setItems(rows);
      // auto-scroll to bottom
      requestAnimationFrame(() => {
        const el = scrollerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch {
      // ignore
    }
  }, [anchorId]);

  React.useEffect(() => {
    load();
  }, [anchorId, load]);

  // Realtime: new comments on anchor
  React.useEffect(() => {
    if (!anchorId) return;
    const ch = supabase
      .channel(`prayers:chat:${anchorId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_prayer_comments", filter: `prayer_id=eq.${anchorId}` },
        async (_payload) => {
          await load(); // reload maintains is_me mapping
        }
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [anchorId, load]);

  // Send a message
  const send = async () => {
    const t = val.trim();
    if (!t || busy || !anchorId) return;
    setBusy(true);
    try {
      await addPrayerComment(anchorId, t);
      setVal("");
      await load();
      // focus input again
      try {
        const input = document.getElementById("f180-chat-input") as HTMLInputElement | null;
        input?.focus();
      } catch {}
    } catch (e: any) {
      alert(e?.message ?? "Failed to send message");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">Community Chat</div>
      </div>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        A simple space for mid-week encouragement. Messages are private to your group.
      </p>

      {loading ? (
        <div className="mt-3 text-sm opacity-70">Loading…</div>
      ) : err ? (
        <div className="mt-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : !anchorId ? (
        <div className="mt-3 text-sm opacity-70">Chat not available.</div>
      ) : (
        <>
          <div
            ref={scrollerRef}
            className="mt-3 max-h-80 overflow-auto rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-3 space-y-2"
          >
            {items.length === 0 && <div className="text-sm opacity-70">No messages yet. Say hello 👋</div>}
            {items.map((c) => (
              <div key={c.id} className={`text-sm ${c.is_me ? "text-right" : "text-left"}`}>
                <span
                  className={`inline-block rounded-lg border px-2 py-1 ${
                    c.is_me
                      ? "bg-[hsl(var(--secondary))] border-[hsl(var(--border))]"
                      : "bg-[hsl(var(--muted))] border-[hsl(var(--border))]"
                  }`}
                >
                  {c.body_text}
                </span>
                <div className="mt-0.5 text-[11px] opacity-60">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              id="f180-chat-input"
              className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none"
              placeholder="Type a message…"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
            />
            <button
              className="rounded-xl bg-white/90 px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
              onClick={send}
              disabled={busy || !val.trim()}
            >
              Send
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ---------- Main page ---------- */
export default function GroupPrayersTabF180({
  groupId,
  active = true, // parent can pass whether this tab is visible
  onNew, // parent can show a badge if new items arrive while inactive
}: {
  groupId: string;
  active?: boolean;
  onNew?: (hasNew: boolean) => void;
}) {
  const { show } = useF180Toast?.() || { show: () => {} };

  const [prayers, setPrayers] = React.useState<PrayerItem[]>([]);
  const [verses, setVerses] = React.useState<GroupVerse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // new prayer form
  const [text, setText] = React.useState("");
  const [visibility, setVisibility] = React.useState<PrayerVisibility>("group");
  const [linkVerseId, setLinkVerseId] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  // edit state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [editVisibility, setEditVisibility] = React.useState<PrayerVisibility>("group");
  const [editVerseId, setEditVerseId] = React.useState<string>("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // realtime notice for new prayers (not chat)
  const [hasNew, setHasNew] = React.useState(false);
  const meRef = React.useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listGroupPrayers(groupId);
      // hide the chat anchor from the main list
      const filtered = (rows || []).filter((r) => !((r as any)?.prayer_text || "").startsWith(CHAT_ANCHOR_PREFIX));
      setPrayers(filtered);
      const vrows = await listGroupVerses(groupId);
      setVerses(vrows.slice(0, 30));
      setHasNew(false);
      onNew?.(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load prayers");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // clear header badge flag when you open this page
    try {
      localStorage.removeItem(`f180.prayers.hasNew.${groupId}`);
    } catch {}
  }, [groupId]);

  React.useEffect(() => {
    if (!groupId) return;
    load();
    supabase.auth.getUser().then(({ data }) => {
      meRef.current = data?.user?.id ?? null;
    });

    const channel = supabase
      .channel(`prayers:${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_prayers", filter: `group_id=eq.${groupId}` },
        (payload) => {
          // ignore chat anchor inserts and my own posts
          const textVal = (payload.new as any)?.prayer_text || "";
          const authorId = (payload.new as any)?.author_id;
          if (textVal.startsWith(CHAT_ANCHOR_PREFIX)) return;
          if (authorId && authorId !== meRef.current) {
            setHasNew(true);
            onNew?.(true);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Clear “new” flag when tab becomes active
  React.useEffect(() => {
    if (active) {
      setHasNew(false);
      onNew?.(false);
      try {
        localStorage.removeItem(`f180.prayers.hasNew.${groupId}`);
      } catch {}
    }
  }, [active, onNew, groupId]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await createPrayer(groupId, t, visibility, linkVerseId || null);
      setText("");
      setVisibility("group");
      setLinkVerseId("");
      await load();
      show?.("Prayer posted.", "success");
    } catch (e: any) {
      show?.(e?.message ?? "Failed to create prayer", "error");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: PrayerItem) => {
    setEditingId(p.id);
    setEditText(p.prayer_text);
    setEditVisibility(p.visibility);
    setEditVerseId(p.verse_id ?? "");
  };

  const saveEdit = async () => {
    if (!editingId || savingEdit) return;
    setSavingEdit(true);
    try {
      await updatePrayer(editingId, {
        text: editText,
        visibility: editVisibility,
        verseId: editVerseId || null,
      });
      setEditingId(null);
      await load();
      show?.("Prayer updated.", "success");
    } catch (e: any) {
      show?.(e?.message ?? "Failed to update prayer", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const removePrayer = async (id: string) => {
    if (deletingId) return;
    if (!confirm("Delete this prayer?")) return;
    setDeletingId(id);
    try {
      await deletePrayer(id);
      await load();
      show?.("Prayer deleted.", "success");
    } catch (e: any) {
      show?.(e?.message ?? "Failed to delete prayer", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="f180 max-w-5xl mx-auto space-y-4">
      {/* Community Chat (comments on hidden anchor) */}
      <CommunityChatCard groupId={groupId} />

      {/* Create prayer */}
      <SectionCard>
        <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
          Create a Prayer
        </div>
        <p className="mt-1 text-sm">
          <Muted>Post a prayer for this group. You can keep it private, share with leaders, or the whole group.</Muted>
        </p>

        <textarea
          className="mt-3 w-full min-h-[90px] rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--popover))] p-3 text-sm text-[hsl(var(--popover-foreground))] outline-none"
          placeholder="Write your prayer…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm">
              <Muted>Visibility</Muted>
            </label>
            <select
              className="rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 py-2 text-sm text-[hsl(var(--popover-foreground))] outline-none"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PrayerVisibility)}
            >
              <option value="group">Group</option>
              <option value="leaders">Leaders only</option>
              <option value="private">Private (only me)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">
              <Muted>Link verse</Muted>
            </label>
            <select
              className="min-w-[200px] rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 py-2 text-sm text-[hsl(var(--popover-foreground))] outline-none"
              value={linkVerseId}
              onChange={(e) => setLinkVerseId(e.target.value)}
            >
              <option value="">— None —</option>
              {verses.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.reference}
                </option>
              ))}
            </select>
          </div>

          <button
            className="h-9 rounded-xl bg-white/90 px-4 text-sm font-medium text-black disabled:opacity-60"
            onClick={submit}
            disabled={busy || !text.trim()}
          >
            {busy ? "Posting…" : "Post Prayer"}
          </button>
        </div>
      </SectionCard>

      {/* New notice for new *prayers* (not chat) */}
      {hasNew && (
        <div className="rounded-[var(--radius)] border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100 flex items-center justify-between">
          <div>New prayer posted.</div>
          <button className="underline" onClick={load}>
            Refresh
          </button>
        </div>
      )}

      {/* List */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
            Group Prayers
          </div>
          <button
            className="rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
            onClick={load}
          >
            Refresh
          </button>
        </div>

        {loading && <div className="mt-3 text-sm opacity-70">Loading…</div>}
        {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
        {!loading && !error && prayers.length === 0 && (
          <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 text-sm text-white/80">
            No prayers yet.
          </div>
        )}

        <div className="mt-3 space-y-3">
          {prayers.map((p) => {
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-white/60">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {p.is_me && (
                        <span className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] text-white/80">
                          You
                        </span>
                      )}
                      <VisibilityBadge v={p.visibility} />
                    </div>
                  </div>

                  {!isEditing && p.is_me && (
                    <div className="flex items-center gap-2">
                      <button className="text-sm underline" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button
                        className="text-sm underline text-red-300 disabled:opacity-50"
                        onClick={() => removePrayer(p.id)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>

                {!isEditing ? (
                  <>
                    <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                      <div className="mb-1 text-xs text-white/60 font-medium">Prayer</div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/90">{p.prayer_text}</p>
                    </div>

                    {/* Comments */}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm underline">Comments {p.comments_count ? `(${p.comments_count})` : ""}</summary>
                      <Comments prayerId={p.id} />
                    </details>
                  </>
                ) : (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full min-h-[90px] rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--popover))] p-3 text-sm text-[hsl(var(--popover-foreground))] outline-none"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm">
                          <Muted>Visibility</Muted>
                        </label>
                        <select
                          className="rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 py-2 text-sm text-[hsl(var(--popover-foreground))] outline-none"
                          value={editVisibility}
                          onChange={(e) => setEditVisibility(e.target.value as PrayerVisibility)}
                        >
                          <option value="group">Group</option>
                          <option value="leaders">Leaders only</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm">
                          <Muted>Link verse</Muted>
                        </label>
                        <select
                          className="min-w-[200px] rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 py-2 text-sm text-[hsl(var(--popover-foreground))] outline-none"
                          value={editVerseId}
                          onChange={(e) => setEditVerseId(e.target.value)}
                        >
                          <option value="">— None —</option>
                          {verses.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.reference}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-xl bg-white/90 px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
                          onClick={saveEdit}
                          disabled={savingEdit}
                        >
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button className="text-sm underline" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
