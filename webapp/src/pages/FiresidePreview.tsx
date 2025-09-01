import React from "react";
import {
  Calendar,
  Target,
  ShieldCheck,
  BookOpenText,
  Star,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

// Logo assets (relative paths)
import logoWordmarkUrl from "../assets/fireside180-wordmark.svg";
import logoMarkUrl from "../assets/fireside180-logo-mark.svg";

// Page wrapper that injects the Fireside 180 theme + header
import F180Page from "../components/F180Page";

export default function FiresidePreview() {
  return (
    <F180Page
      nav={
        [
          ["Groups", "/#/groups"],
          ["Verses", "/#/verses"],
          ["Devotions", "/#/devotions"],
          ["Journal", "/#/journal"],
          ["Inbox", "/#/inbox"], // was Chat
          ["Prayers", "/#/prayers"],
          ["Library", "/#/library"],
        ].map(([label, href]) => ({ label, href }))
      }
      logoMarkSrc={logoMarkUrl}
      logoWordmarkSrc={logoWordmarkUrl}
    >
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
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Verse card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                <h2 className="text-lg font-semibold tracking-tight">
                  Verse of the Day • Romans 5:8
                </h2>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                “But God shows his love for us in that while we were still
                sinners, Christ died for us.”
              </p>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed">
                <span className="font-medium">Plain words:</span> God didn’t
                wait for us to get our act together. He loved first, and Jesus
                proved it.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>Love</Badge>
                <Badge variant="outline">Grace</Badge>
                <Badge variant="outline">Identity</Badge>
              </div>
              <div className="mt-6 flex gap-3">
                <PrimaryButton>
                  Open in Verses <ArrowRight className="ml-1 h-4 w-4" />
                </PrimaryButton>
                <GhostButton>
                  Star <Star className="ml-1 h-4 w-4" />
                </GhostButton>
              </div>
            </CardBody>
          </Card>

          {/* Journal (SOAP) */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold tracking-tight">
                Journal • SOAP
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                What you write here can be private or shared with your group.
              </p>
            </CardHeader>
            <CardBody>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 hover:bg-[hsl(var(--card))]/80">
                  <span className="text-sm font-medium">Romans 5:8 • Expand</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Scripture, Observation, Application, Prayer
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  <Field label="Observation">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      What do you notice? What does this show about God?
                    </p>
                  </Field>
                  <Field label="Application">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      What will you do this week because of this?
                    </p>
                  </Field>
                  <Field label="Prayer">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Talk to the Father in your own words.
                    </p>
                  </Field>
                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1">
                        Visibility: Private
                      </span>
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
              <h3 className="text-base font-semibold tracking-tight">
                Your Highlights
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                From devotions and studies
              </p>
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
                {["Hope", "Identity", "Freedom", "Week 4 Notes"].map((t) => (
                  <a
                    key={t}
                    href="#"
                    className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-sm hover:border-[hsl(var(--primary))]"
                  >
                    {t}
                  </a>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </F180Page>
  );
}

/* ---------- Simple primitives (self-contained styles) ---------- */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      {children}
    </div>
  );
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-1 border-b border-[hsl(var(--border))] p-4">{children}</div>
  );
}
function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}

function InfoTile({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 shadow-sm">
      <div className="grid h-9 w-9 place-content-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">{sub}</div>
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "solid" as "solid" | "outline",
}) {
  if (variant === "outline") {
    return (
      <span className="rounded-full border border-[hsl(var(--border))] px-2.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
        {children}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[hsl(var(--primary))] px-2.5 py-0.5 text-xs text-[hsl(var(--primary-foreground))]">
      {children}
    </span>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] outline-none transition hover:bg-[hsl(var(--primary))]/90 focus-visible:ring-4 focus-visible:ring-[hsl(var(--accent)/0.40)]">
      {children}
    </button>
  );
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium outline-none transition hover:border-[hsl(var(--primary))] focus-visible:ring-4 focus-visible:ring-[hsl(var(--accent)/0.40)]">
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
      <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
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
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-content-center rounded-xl bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      {sub && <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{sub}</div>}
    </div>
  );
}
