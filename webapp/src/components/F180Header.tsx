import React from "react";
import { Flame } from "lucide-react";

export type F180HeaderLink = { label: string; href: string };

export default function F180Header({
  nav,
  logoMarkSrc,
  logoWordmarkSrc,
}: {
  nav: F180HeaderLink[];
  logoMarkSrc?: string;
  logoWordmarkSrc?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <a href={nav?.[0]?.href ?? "#"} className="flex items-center gap-2">
          {logoMarkSrc ? (
            <img src={logoMarkSrc} alt="Fireside 180" className="h-8 w-8 rounded-xl" />
          ) : (
            <div
              className="grid h-8 w-8 place-content-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow"
              aria-hidden
            >
              <Flame className="h-5 w-5" />
            </div>
          )}
          <div className="leading-tight">
            {logoWordmarkSrc ? (
              <img src={logoWordmarkSrc} alt="Fireside 180" className="hidden sm:block h-5" />
            ) : (
              <>
                <div className="font-semibold tracking-tight">Fireside 180</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Brotherhood • Scripture • Action
                </div>
              </>
            )}
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-2 text-sm">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full px-3 py-1 text-[hsl(var(--foreground))]/95 hover:bg-[hsl(var(--card))] border border-transparent hover:border-[hsl(var(--border))]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
