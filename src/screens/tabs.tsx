"use client";
import type { ReactNode } from "react";
import { useGo } from "@/state/app";
import { useLifecycle } from "@/state/lifecycle";
import { PfPageTabs, type PageTab } from "@/components/os/ui";

import Dashboard from "./Dashboard";
import Search from "./Search";
import Requisitions from "./Requisitions";
import Jobs from "./Jobs";
import Candidates from "./Candidates";
import Shortlist from "./Shortlist";
import Profile from "./Profile";
import Calendar from "./Calendar";
import Schedule from "./Schedule";
import Messages from "./Messages";
import Notifications from "./Notifications";
import Analytics from "./Analytics";
import Audit from "./Audit";
import Dei from "./Dei";
import Qoh from "./Qoh";
import Integrations from "./Integrations";
import Planning from "./Planning";
import Role from "./Role";
import Sourcing from "./Sourcing";
import Screening from "./Screening";
import Assessment from "./Assessment";
import Interview from "./Interview";
import Selection from "./Selection";
import Reference from "./Reference";
import Offer from "./Offer";
import Onboarding from "./Onboarding";
import Posthire from "./Posthire";

/**
 * Every page is a tab-based page: each nav section renders as ONE tabbed
 * surface (underline tabs + count chips), with tabs navigating the canonical
 * routes so URLs, the sidebar and deep links all stay in sync.
 */
function TabSurface({ tabs, active, content }: { tabs: PageTab[]; active: string; content: Record<string, ReactNode> }) {
  const go = useGo();
  return (
    <div>
      <PfPageTabs tabs={tabs} active={active} onSelect={(k) => go(k)} />
      {content[active]}
    </div>
  );
}

/* ------------------------------- Overview ------------------------------ */

export function OverviewTabs({ active }: { active: string }) {
  return (
    <TabSurface
      active={active}
      tabs={[
        { key: "dashboard", label: "Recruitment overview" },
        { key: "search", label: "Search" },
      ]}
      content={{ dashboard: <Dashboard />, search: <Search /> }}
    />
  );
}

/* -------------------------------- Hiring ------------------------------- */

/**
 * The app shipped TWO JD generators: Requisitions' DraftTab (persisted, on the
 * one generator) and NewRole.tsx (a near-clone with hardcoded output, down to
 * the identical empty-state copy). There is now exactly one. The legacy
 * /new-role route stays alive but resolves onto it, opening the conversational
 * intake — so "New Role" from Open roles still lands somewhere real.
 */
export function HiringTabs({ active }: { active: string }) {
  const { requisitions, roles } = useLifecycle();
  const legacyNewRole = active === "newrole";
  return (
    <TabSurface
      active={legacyNewRole ? "requisitions" : active}
      tabs={[
        { key: "requisitions", label: "Requisitions", count: String(requisitions.length) },
        { key: "jobs", label: "Open roles", count: String(roles.length) },
      ]}
      content={{ requisitions: <Requisitions initialTab={legacyNewRole ? "describe" : "list"} />, jobs: <Jobs /> }}
    />
  );
}

/* ------------------------------ Candidates ----------------------------- */

export function CandidatesTabs({ active }: { active: string }) {
  const { candidates } = useLifecycle();
  return (
    <TabSurface
      active={active}
      tabs={[
        { key: "candidates", label: "All candidates", count: String(candidates.length) },
        { key: "shortlist", label: "AI shortlist", count: "12" },
        { key: "profile", label: "Candidate profile" },
      ]}
      content={{ candidates: <Candidates />, shortlist: <Shortlist />, profile: <Profile /> }}
    />
  );
}

/* ------------------------------ Scheduling ----------------------------- */

export function SchedulingTabs({ active }: { active: string }) {
  return (
    <TabSurface
      active={active}
      tabs={[
        { key: "calendar", label: "Interview calendar", count: "8" },
        { key: "schedule", label: "Schedule interview" },
      ]}
      content={{ calendar: <Calendar />, schedule: <Schedule /> }}
    />
  );
}

/* -------------------------------- Inbox -------------------------------- */

export function InboxTabs({ active }: { active: string }) {
  return (
    <TabSurface
      active={active}
      tabs={[
        { key: "messages", label: "Messages", count: "3" },
        { key: "notifications", label: "Notifications", count: "4" },
      ]}
      content={{ messages: <Messages />, notifications: <Notifications /> }}
    />
  );
}

/* ------------------------------- Insights ------------------------------ */

export function InsightsTabs({ active }: { active: string }) {
  return (
    <TabSurface
      active={active}
      tabs={[
        { key: "analytics", label: "Analytics" },
        { key: "audit", label: "Audit log" },
        { key: "dei", label: "Diversity & inclusion" },
        { key: "qoh", label: "Quality-of-hire" },
        { key: "integrations", label: "Integrations & access" },
      ]}
      content={{ analytics: <Analytics />, audit: <Audit />, dei: <Dei />, qoh: <Qoh />, integrations: <Integrations /> }}
    />
  );
}

/* ------------------------- Lifecycle (11 stages) ------------------------ */

export function LifecycleTabs({ active }: { active: string }) {
  return (
    <TabSurface
      active={active}
      tabs={[
        { key: "planning", label: "Planning", mono: "01" },
        { key: "role", label: "Role", mono: "02" },
        { key: "sourcing", label: "Sourcing", mono: "03" },
        { key: "screening", label: "Screening", mono: "04" },
        { key: "assessment", label: "Assessment", mono: "05" },
        { key: "interview", label: "Interview", mono: "06" },
        { key: "selection", label: "Selection", mono: "07" },
        { key: "reference", label: "Reference", mono: "08" },
        { key: "offer", label: "Offer", mono: "09" },
        { key: "onboarding", label: "Onboarding", mono: "10" },
        { key: "posthire", label: "Post-hire", mono: "11" },
      ]}
      content={{
        planning: <Planning />, role: <Role />, sourcing: <Sourcing />, screening: <Screening />,
        assessment: <Assessment />, interview: <Interview />, selection: <Selection />, reference: <Reference />,
        offer: <Offer />, onboarding: <Onboarding />, posthire: <Posthire />,
      }}
    />
  );
}
