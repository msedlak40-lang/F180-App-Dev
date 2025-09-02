import React from "react";
import { Flame } from "lucide-react";
import { supabase } from "../lib/supabaseClient"; // NOTE: path is ../lib from /components

export type F180HeaderLink = { label: string; href?: string };

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function F180Header({
  nav,
  logoMarkSrc,
  logoWordmarkSrc,
}: {
  nav: F180HeaderLink[];
  logoMarkSrc?: string;
  logoWordmarkSrc?: string;
}) {
  const [currentGid, setCurrentGid] = React.useState<string | null>(null);
  const [hasNewPrayers, setHasNewPrayers] = React.useState<boolean>(false);
  const meRef = React.useRef<string | null>(null);
  const channelRef = React.useRef<any>(null);

  // who am I
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      meRef.current = data?.user?.id ?? null;
    });
  }, []);

  // poll for gid changes & local badge flag
  React.useEffect(() => {
    const tick = () => {
      const gid = safeGet("f180.currentGroupId");
      if (gid !== currentGid) {
        setCurrentGid(gid);
      }
      if (gid) {
        const flag = safeGet(`f180.prayers.hasNew.${gid}`) === "1";
        setHasNewPrayers(flag);
      } else {
        setHasNewPrayers(false);
      }
    };
    tick();
    const h = window.setInterval(tick, 1000);
    return () => window.clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGid]);

  // subscribe to new prayers for current group
  React.useEffect(() => {
    // cleanup previous
    try {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    } catch {}
    if (!currentGid) return;

    // initialize from localStorage
    setHasNewPrayers(safeGet(`f180.prayers.hasNew.${currentGid}`) === "1");

    const ch = supabase
      .channel(`prayers:badge:${currentGid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_prayers", filter: `group_id=eq.${currentGid}` },
        (payload) => {
          const authorId = (payload.new as any)?.author_id;
          if (authorId && authorId === meRef.current) return; // ignore my own posts
          try {
            localStorage.setItem(`f180.prayers.hasNew.${currentGid}`, "1");
          } catch {}
          setHasNewPrayers(true);
        }
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [currentGid]);

  // clicking the Prayers nav item clears the badge for the current group
  function handlePrayersClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!currentGid) return;
    try {
      localStorage.removeItem(`f180.prayers.hasNew.${currentGid}`);
    } catch {}
    setHasNewPrayers(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        {/* Logo → always go to the F180 Home */}
        <a
          href="#/home-f180"
          className="flex items-center gap-3"
          onClick={(e) => {
            e.preventDefault();
            window.location.hash = "/home-f180";
          }}
          aria-label="Go to Fireside 180 Home"
        >
          {logoMarkSrc ? (
            <img
              src={logoMarkSrc}
              alt="Fireside 180"
              className="h-10 w-10 rounded-2xl"
            />
          ) : (
            <div
              className="grid h-10 w-10 place-content-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow"
              aria-hidden
            >
              <Flame className="h-6 w-6" />
            </div>
          )}

          <div className="leading-tight">
            {logoWordmarkSrc ? (
              <img
                src={logoWordmarkSrc}
                alt="Fireside 180"
                className="hidden sm:block h-7 md:h-8 w-auto"
              />
            ) : (
              <>
                <div className="text-base md:text-lg font-semibold tracking-tight">
                  Fireside 180
                </div>
                <div className="text-[11px] md:text-xs text-[hsl(var(--muted-foreground))]">
                  Brotherhood • Scripture • Action
                </div>
              </>
            )}
          </div>
        </a>

        {/* Top navigation */}
        <nav className="hidden md:flex items-center gap-2 text-sm">
          {nav.map((item) => {
            const isPrayers = item.label.toLowerCase() === "prayers";
            return (
              <a
                key={item.label}
                href={item.href || "#"}
                onClick={(e) => {
                  if (isPrayers) handlePrayersClick(e);
                }}
                className="relative rounded-full px-3 py-1 text-[hsl(var(--foreground))]/95 hover:bg-[hsl(var(--card))] border border-transparent hover:border-[hsl(var(--border))]"
              >
                <span className="inline-flex items-center gap-1">
                  {item.label}
                  {isPrayers && hasNewPrayers && (
                    <span
                      title="New prayers"
                      aria-label="New prayers"
                      className="inline-block h-2 w-2 rounded-full bg-red-500"
                    />
                  )}
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
