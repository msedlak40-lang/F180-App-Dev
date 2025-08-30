import React from "react";
import { Flame, Calendar, Target, ShieldCheck, BookOpenText, Star, MessageCircle, ArrowRight } from "lucide-react";
import logoWordmarkUrl from "../assets/fireside180-wordmark.svg";
import logoMarkUrl from "../assets/fireside180-logo-mark.svg";

// Optional: drop your logo assets here (SVG recommended)
// If you don't have them yet, these imports can stay and you'll see the fallback flame icon.
// Adjust paths if your assets live elsewhere.


/**
 * Fireside 180 — Visual Baseline (no deps beyond Tailwind + lucide-react)
 * Palette tokens (inline via Tailwind arbitrary colors):
 * - bg:       #0E0E0E
 * - surface:  #161616
 * - border:   #2A2A2A
 * - text:     #E6E6E6
 * - muted:    #A6A6A6
 * - primary:  #C1121F (hover #A50F1A)
 * - ember:    #FF6B35 (focus ring rgba(255,107,53,.4))
 */

export default function FiresidePreview() {
  return (
    <div className="min-h-screen bg-[#0E0E0E] text-[#E6E6E6]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#2A2A2A] bg-[#0E0E0E]/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            {/* If logo assets exist, show them; otherwise fallback to Flame mark + text */}
            {logoMarkUrl ? (
              <img src={logoMarkUrl} alt="Fireside 180" className="h-8 w-8 rounded-xl" />
            ) : (
              <div className="grid h-8 w-8 place-content-center rounded-xl bg-[#C1121F] shadow" aria-hidden>
                <Flame className="h-5 w-5" />
              </div>
            )}
            <div className="leading-tight">
              {logoWordmarkUrl ? (
                <img src={logoWordmarkUrl} alt="Fireside 180" className="hidden sm:block h-5" />
              ) : (
                <>
                  <div className="font-semibold tracking-tight">Fireside 180</div>
                  <div className="text-xs text-[#A6A6A6]">Brotherhood • Scripture • Action</div>
                </>
              )}
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-2 text-sm">
            {[
              ["Groups","#"],
              ["Verses","#"],
              ["Devotions","#"],
              ["Journal","#"],
              ["Inbox","#"],
              ["Prayers","#"],
              ["Library","#"],
            ].map(([label,href]) => (
              <a key={label}
                 href={href as string}
                 className="rounded-full px-3 py-1 text-[#E6E6E6] hover:bg-[#161616] border border-transparent hover:border-[#2A2A2A]">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* This Week strip */}
        <section className="grid gap-3 sm:grid-cols-3">
          <InfoTile
            icon={<Calendar className="h-5 w-5" />}
            title="Next Fireside"
            sub="Thu 7:00 PM • Crosspoint"
          />
          <InfoTile
            icon={<Target className="h-5 w-5" />}
            title="This Week's Nudge"
            sub="Text a brother and share one win"
          />
          <InfoTile
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Your Streak"
            sub="3 days in the Word"
          />
        </section>

        {/* Two-column content */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Verse card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpenText className="h-5 w-5 text-[#A6A6A6]" />
                  <h2 className="text-lg font-semibold tracking-tight">Verse of the Day • Romans 5:8</h2>
                </div>
                <p className="text-sm text-[#A6A6A6]">“But God shows his love for us in that while we were still sinners, Christ died for us.”</p>
              </CardHeader>
              <CardBody>
                <p className="text-sm leading-relaxed text-[#E6E6E6]">
                  <span className="font-medium">Plain words:</span> God didn’t wait for us to get our act together. He loved first, and Jesus proved it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>Love</Badge>
                  <Badge variant="outline">Grace</Badge>
                  <Badge variant="outline">Identity</Badge>
                </div>
                <div className="mt-6 flex gap-3">
                  <PrimaryButton>Open in Verses <ArrowRight className="ml-1 h-4 w-4" /></PrimaryButton>
                  <GhostButton>Star <Star className="ml-1 h-4 w-4" /></GhostButton>
                </div>
              </CardBody>
            </Card>

            {/* Journal (SOAP) */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold tracking-tight">Journal • SOAP</h2>
                <p className="text-xs text-[#A6A6A6]">What you write here can be private or shared with your group.</p>
              </CardHeader>
              <CardBody>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[#2A2A2A] bg-[#161616] px-4 py-3 hover:bg-[#161616]/80">
                    <span className="text-sm font-medium">Romans 5:8 • Expand</span>
                    <span className="text-xs text-[#A6A6A6]">Scripture, Observation, Application, Prayer</span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    <Field label="Observation"><p className="text-sm text-[#A6A6A6]">What do you notice? What does this show about God?</p></Field>
                    <Field label="Application"><p className="text-sm text-[#A6A6A6]">What will you do this week because of this?</p></Field>
                    <Field label="Prayer"><p className="text-sm text-[#A6A6A6]">Talk to the Father in your own words.</p></Field>
                    <div className="pt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-[#A6A6A6]">
                        <span className="rounded-full border border-[#2A2A2A] px-2 py-1">Visibility: Private</span>
                      </div>
                      <PrimaryButton>Save</PrimaryButton>
                    </div>
                  </div>
                </details>
              </CardBody>
            </Card>
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold tracking-tight">Your Highlights</h3>
                <p className="text-xs text-[#A6A6A6]">From devotions and studies</p>
              </CardHeader>
              <CardBody>
                <EmptyState
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="No highlights yet"
                  sub="You’re not alone. Small steps count. Try highlighting a line from today’s devotion."
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold tracking-tight">Collections</h3>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {['Hope','Identity','Freedom','Week 4 Notes'].map((t) => (
                    <a key={t} href="#" className="rounded-full border border-[#2A2A2A] bg-[#161616] px-3 py-1 text-sm hover:border-[#C1121F]">{t}</a>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-[#A6A6A6]">
        Built for men who keep showing up. 
      </footer>
    </div>
  );
}

// --- Simple primitives (no external UI library needed) ---
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] shadow-sm">{children}</div>
  );
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1 border-b border-[#2A2A2A] p-4">{children}</div>;
}
function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}

function InfoTile({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#161616] px-4 py-3 shadow-sm">
      <div className="grid h-9 w-9 place-content-center rounded-xl bg-[#C1121F] text-white">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[#A6A6A6]">{sub}</div>
      </div>
    </div>
  );
}

function Badge({ children, variant = "solid" as "solid" | "outline" }) {
  if (variant === "outline") {
    return (
      <span className="rounded-full border border-[#2A2A2A] px-2.5 py-0.5 text-xs text-[#A6A6A6]">{children}</span>
    );
  }
  return (
    <span className="rounded-full bg-[#C1121F] px-2.5 py-0.5 text-xs text-white">{children}</span>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="inline-flex items-center rounded-xl bg-[#C1121F] px-3 py-2 text-sm font-medium text-white outline-none transition hover:bg-[#A50F1A] focus-visible:ring-4 focus-visible:ring-[rgba(255,107,53,0.40)]"
    >
      {children}
    </button>
  );
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="inline-flex items-center rounded-xl border border-[#2A2A2A] bg-[#161616] px-3 py-2 text-sm font-medium text-[#E6E6E6] outline-none transition hover:border-[#C1121F] focus-visible:ring-4 focus-visible:ring-[rgba(255,107,53,0.40)]"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#0E0E0E] p-3">
      <div className="mb-1 text-xs font-medium text-[#A6A6A6]">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#0E0E0E] p-6 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-content-center rounded-xl bg-[#161616] text-[#A6A6A6]">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      {sub && <div className="mt-1 text-xs text-[#A6A6A6]">{sub}</div>}
    </div>
  );
}
