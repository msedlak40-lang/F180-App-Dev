// src/App.tsx
import * as React from "react";
import { supabase } from "./lib/supabaseClient";

import { F180ToastProvider as ToastProvider } from "./components/f180/F180ToastProvider";
import F180Page from "./components/F180Page";

// --- Pages (F180-first) ---
import HomePage from "./pages/Home/HomePageF180";

import VersesTab from "./pages/Group/VersesTabF180";
import DevotionsTab from "./pages/Group/DevotionsTabF180";
import StudyTab from "./pages/Group/StudyTabF180";
import JournalTab from "./pages/Group/JournalTabF180";
import PrayersTab from "./pages/Group/GroupPrayersTabF180";
import Login from "./pages/Auth/Login";

import RequestGroupPage from "./pages/Group/RequestGroupPageF180";
import ApprovalsPage from "./pages/Admin/ApprovalsPageF180";
import GroupMembersPage from "./pages/Group/GroupMembersPageF180";

import AcceptStudyInvite from "./pages/AcceptStudyInvite";

// -------------- tiny hash router helper --------------
function useHashRoute() {
  const [hash, setHash] = React.useState<string>(() => window.location.hash || "#/");

  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [path, queryStr] = raw.split("?");
  const segments = path.replace(/^\/+/, "").split("/").filter(Boolean);
  const query = React.useMemo(() => new URLSearchParams(queryStr || ""), [queryStr]);

  return { segments, query };
}

export default function App() {
  const { segments } = useHashRoute();
  const [ready, setReady] = React.useState(false);

  // Init Supabase auth before rendering routes
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await supabase.auth.getSession();
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Current route bits (compute before any returns to keep hook order stable)
  const isGroup = segments[0] === "group" && !!segments[1];
  const gid = isGroup ? segments[1] : "";
  const tab = isGroup ? (segments[2] || "devotions") : "";

  // Remember last group so nav works from Home/Request/Approvals too
  const [lastGid, setLastGid] = React.useState<string>(() => {
    try {
      return localStorage.getItem("last_gid") || "";
    } catch {
      return "";
    }
  });
  React.useEffect(() => {
    if (gid) {
      try {
        localStorage.setItem("last_gid", gid);
        setLastGid(gid);
      } catch {}
    }
  }, [gid]);

  const activeGid = gid || lastGid;

  // Header nav: ALWAYS show Home + the 5 tabs (order you requested).
  // If no group known yet, tab links point to Home so nothing breaks.
  const nav = React.useMemo(() => {
    const home = { label: "Home", href: "#/" };
    const base = activeGid ? `#/group/${activeGid}` : "#/";
    return [
      home,
      { label: "Devotions", href: activeGid ? `${base}/devotions` : base },
      { label: "Study",     href: activeGid ? `${base}/study`     : base },
      { label: "Verses",    href: activeGid ? `${base}/verses`    : base },
      { label: "Prayers",   href: activeGid ? `${base}/prayers`   : base },
      { label: "Journal",   href: activeGid ? `${base}/journal`   : base },
    ];
  }, [activeGid]);

  if (!ready) {
    return (
      <div className="f180 min-h-screen bg-[hsl(var(--secondary))]">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm opacity-70">Loading…</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <F180Page nav={nav}>
        {/* ---------- ROUTES ---------- */}

        {/* HOME */}
        {segments.length === 0 && (
          <>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">Home</h1>
            <HomePage />
          </>
        )}
	{/* Login */}
        {segments[0] === "login" && (
         <div className="mx-auto max-w-md px-4 py-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">Sign in</h1>
          <Login />
         </div>
        )}

        {/* Accept study invite */}
        {segments[0] === "accept-study-invite" && <AcceptStudyInvite />}

        {/* Request a group — route still works (not in top nav) */}
        {(segments[0] === "request-group" || segments[0] === "request-group-f180") && (
          <div className="mx-auto max-w-5xl px-4 py-6">
            <RequestGroupPage />
          </div>
        )}

        {/* Admin approvals — route still works (not in top nav) */}
        {((segments[0] === "admin" && segments[1] === "approvals") ||
          (segments[0] === "admin" && segments[1] === "approvals-f180")) && (
          <div className="mx-auto max-w-6xl px-4 py-6">
            <ApprovalsPage />
          </div>
        )}

        {/* Group members — accept both plain and -f180 */}
        {isGroup && (segments[2] === "members" || segments[2] === "members-f180") && (
          <div className="mx-auto max-w-6xl px-3 md:px-6 py-4">
            <GroupMembersPage groupId={gid} />
          </div>
        )}

        {/* Special Verses route used by HomePageF180 (verses-style) */}
        {isGroup && segments[2] === "verses-style" && (
          <div className="mx-auto max-w-6xl px-3 md:px-6 py-4">
            <VersesTab groupId={gid} />
          </div>
        )}

        {/* Group tabs */}
        {isGroup &&
          (!segments[2] ||
            ["verses", "devotions", "study", "journal", "prayers"].includes(segments[2])) && (
            <div className="mx-auto max-w-6xl px-3 md:px-6 py-4">
              {(() => {
                switch (tab) {
                  case "verses":
                    return <VersesTab groupId={gid} />;
                  case "study":
                    return <StudyTab groupId={gid} />;
                  case "journal":
                    return <JournalTab groupId={gid} />;
                  case "prayers":
                    return <PrayersTab groupId={gid} />; // F180 version
                  case "devotions":
                  default:
                    return <DevotionsTab groupId={gid} />;
                }
              })()}
            </div>
          )}

        {/* Fallback → Home */}
        {segments.length > 0 &&
          !isGroup &&
          segments[0] !== "request-group" &&
          segments[0] !== "request-group-f180" &&
          !(
            segments[0] === "admin" &&
            (segments[1] === "approvals" || segments[1] === "approvals-f180")
          ) &&
          segments[0] !== "accept-study-invite" && (
            <>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">Home</h1>
              <HomePage />
            </>
          )}
      </F180Page>
    </ToastProvider>
  );
}
