import React from "react";

// Shell + toasts
import F180Page from "../components/F180Page";
import { F180ToastProvider } from "../components/f180/F180ToastProvider";
import { ToastProvider } from "../components/ToastProvider";

// Preview pages
import VersesTabF180 from "../pages/Group/VersesTabF180";
import ApprovalsPageF180 from "../pages/Admin/ApprovalsPageF180";
import RequestGroupPageF180 from "../pages/Group/RequestGroupPageF180";
import GroupMembersPageF180 from "../pages/Group/GroupMembersPageF180";
import HomePageF180 from "../pages/Home/HomePageF180";
import DevotionsTabF180 from "../pages/Group/DevotionsTabF180";
import StudyTabF180 from "../pages/Group/StudyTabF180";
import LibraryPageF180 from "../pages/Library/LibraryPageF180";
import JournalTabF180 from "../pages/Group/JournalTabF180";
import GroupPrayersTabF180 from "../pages/Group/GroupPrayersTabF180"; // NEW

// Assets (logos)
import logoWordmarkUrl from "../assets/fireside180-wordmark.svg";
import logoMarkUrl from "../assets/fireside180-logo-mark.svg";

/** Build the top menu. Reads latest group id from localStorage at click time. */
function buildNav(): Array<{ label: string; href?: string; onClick?: () => void; disabled?: boolean }> {
  const getGid = () => {
    try {
      return localStorage.getItem("f180.currentGroupId");
    } catch {
      return null;
    }
  };
  const goto = (hash: string) => {
    // IMPORTANT: pass "#/..." (not "/#/...") to avoid double-hash
    window.location.hash = hash;
  };

  // Helper for group-scoped items
  const groupItem = (label: string, path: (gid: string) => string) => {
    return {
      label,
      onClick: () => {
        const gid = getGid();
        if (!gid) return;
        goto(path(gid));
      },
      href: (() => {
        const gid = getGid();
        return gid ? path(gid) : undefined;
      })(),
      disabled: !getGid(),
    };
  };

  return [
    { label: "Home", href: "#/home-f180", onClick: () => goto("#/home-f180") },
    groupItem("Verses", (gid) => `#/group/${gid}/verses-style`), // keep existing route name
    groupItem("Devotion", (gid) => `#/group/${gid}/devotions-f180`),
    groupItem("Study", (gid) => `#/group/${gid}/study-f180`),
    // groupItem("Members", (gid) => `#/group/${gid}/members-f180`),
    groupItem("Journal", (gid) => `#/group/${gid}/journal-f180`),
    groupItem("Prayers", (gid) => `#/group/${gid}/prayers-f180`), // NEW
    // { label: "Library", href: "#/library-f180", onClick: () => goto("#/library-f180") },
    // { label: "Approvals", href: "#/admin/approvals-f180", onClick: () => goto("#/admin/approvals-f180") },
  ];
}

/**
 * Given hash segments (after `/#/`), return a preview page.
 * App.tsx expects a **named export**: renderF180PreviewRoute
 */
export function renderF180PreviewRoute(segments: string[]) {
  // ---------- Approvals (preview route) ----------
  if (segments[0] === "admin" && segments[1] === "approvals-f180") {
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page
            nav={buildNav()}
            logoMarkSrc={logoMarkUrl}
            logoWordmarkSrc={logoWordmarkUrl}
          >
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Approvals (styled preview)</h1>
              <ApprovalsPageF180 />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Home (preview) ----------
  // URL: /#/home-f180
  if (segments[0] === "home-f180") {
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
              <HomePageF180 />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Verses (preview route) ----------
  // Usage: /#/group/{id}/verses-style
  if (segments[0] === "group" && segments[1] && segments[2] === "verses-style") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page
            nav={buildNav()}
            logoMarkSrc={logoMarkUrl}
            logoWordmarkSrc={logoWordmarkUrl}
          >
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Verses (styled preview)</h1>
              <VersesTabF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Journal (preview route) ----------
  // URL: /#/group/{id}/journal-f180
  if (segments[0] === "group" && segments[1] && segments[2] === "journal-f180") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Journal (styled preview)</h1>
              <JournalTabF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Devotions (preview route) ----------
  // Usage: /#/group/{id}/devotions-f180
  if (segments[0] === "group" && segments[1] && segments[2] === "devotions-f180") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Devotion (styled preview)</h1>
              <DevotionsTabF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Study (preview route) ----------
  // Usage: /#/group/{id}/study-f180
  if (segments[0] === "group" && segments[1] && segments[2] === "study-f180") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Study (styled preview)</h1>
              <StudyTabF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Prayers (preview route) ----------  // NEW
  // Usage: /#/group/{id}/prayers-f180
  if (segments[0] === "group" && segments[1] && segments[2] === "prayers-f180") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Prayers (styled preview)</h1>
              <GroupPrayersTabF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Request Group (preview route) ----------
  if (segments[0] === "request-group-f180") {
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Request Group (styled preview)</h1>
              <RequestGroupPageF180 />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Group Members (preview route) ----------
  // Usage: /#/group/{id}/members-f180  (append ?demo=1 to use demo data)
  if (segments[0] === "group" && segments[1] && segments[2] === "members-f180") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Members (styled preview)</h1>
              <GroupMembersPageF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Library (preview route) ----------
  // Usage: /#/library-f180
  if (segments[0] === "library-f180") {
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page nav={buildNav()} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Library (styled preview)</h1>
              <LibraryPageF180 />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // no preview match
  return null;
}
