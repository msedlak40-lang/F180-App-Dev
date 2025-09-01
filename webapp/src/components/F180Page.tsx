import React from "react";
import F180Header from "./F180Header";

// Local type to avoid runtime import of types
type F180HeaderLink = { label: string; href: string };

type Props = {
  nav: F180HeaderLink[];
  logoMarkSrc?: string;
  logoWordmarkSrc?: string;
  children: React.ReactNode;
};

/**
 * F180Page — self-contained page wrapper that injects Fireside 180 theme
 * (inline CSS vars) + header. Use it to “preview” the look around any content.
 */
export default function F180Page({
  nav,
  logoMarkSrc,
  logoWordmarkSrc,
  children,
}: Props) {
  const themeVars: React.CSSProperties = {
    ["--background" as any]: "0 0% 5.5%",       // #0E0E0E
    ["--foreground" as any]: "0 0% 90.2%",      // #E6E6E6
    ["--card" as any]: "0 0% 8.6%",             // #161616
    ["--border" as any]: "0 0% 16.5%",          // #2A2A2A
    ["--primary" as any]: "355.5 82.9% 41.4%",  // #C1121F
    ["--primary-foreground" as any]: "0 0% 100%",
    ["--accent" as any]: "16 100% 60.4%",       // #FF6B35
    ["--muted-foreground" as any]: "0 0% 65.1%",// #A6A6A6
  };

  return (
    <div
      className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
      style={themeVars}
    >
      <F180Header
        nav={nav}
        logoMarkSrc={logoMarkSrc}
        logoWordmarkSrc={logoWordmarkSrc}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
        Built for men who keep showing up.
      </footer>
    </div>
  );
}
