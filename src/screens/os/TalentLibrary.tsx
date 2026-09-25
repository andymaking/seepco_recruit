"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useLifecycle } from "@/state/lifecycle";
import { useWorkspace } from "@/state/workspace";
import { POOLS, type Pool } from "@/data/talentos";
import { SHORTLIST, type ShortlistCandidate } from "@/data/people";
import type { DirCandidate } from "@/data/people";
import { forwardingFor, HRIS_SOURCES, BACKLOG_PROMISE, type ImportSource } from "@/data/recruiterOnboarding";
import { PfAvatar, PfBadge, PfBanner, PfBtn, PfCard, PfCardHead, PfPageTabs, PfProgress, PfStat, PfTh, PfTile, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------ Local view data ------------------------------ */

/** Per-member CRM meta (last-active, source, match-to-open-roles) — keyed by SHORTLIST name. */
const MEMBER_META: Record<string, { last: string; lastTone: PfTone; src: string; srcTone: PfTone; match: number }> = {
  "Adaeze Obi": { last: "2d ago", lastTone: "green", src: "Stage 7 · SPD-2026", srcTone: "blue", match: 92 },
  "Chidi Okafor": { last: "6d ago", lastTone: "green", src: "Stage 7 · SPD-2026", srcTone: "blue", match: 88 },
  "Zainab Bello": { last: "3w ago", lastTone: "yellow", src: "LinkedIn", srcTone: "grey", match: 84 },
  "Tunde Bakare": { last: "11d ago", lastTone: "green", src: "Referral", srcTone: "purple", match: 81 },
  "Fatima Yusuf": { last: "5w ago", lastTone: "yellow", src: "Campus '26", srcTone: "green", match: 76 },
  "Emeka Nwosu": { last: "2mo ago", lastTone: "yellow", src: "Job board", srcTone: "grey", match: 71 },
  "Ngozi Eze": { last: "4mo ago", lastTone: "grey", src: "Careers page", srcTone: "grey", match: 64 },
};

const matchTone = (m: number): PfTone => (m >= 85 ? "green" : m >= 72 ? "yellow" : "grey");

/** Alumni open to return — the 3 flagged in the Boomerang pool (fresh: "3 open to return"). */
type Alum = { name: string; init: string; tone: string; role: string; left: string; note: string };
const BOOMERANG: Alum[] = [
  { name: "Bola Adeyemi", init: "BA", tone: "#475569", role: "Ops Supervisor · Field Operations", left: "Left Mar 2025", note: "Exit interview: would return for a Lagos ops seat without rotation." },
  { name: "Ifeoma Chukwu", init: "IC", tone: "#AF52DE", role: "Product Designer · Product & Design", left: "Left Jan 2026", note: "Relocated to the UK — open to remote-first senior design roles." },
  { name: "Musa Abdullahi", init: "MA", tone: "#16B364", role: "Payments Engineer · Engineering", left: "Left Aug 2025", note: "Startup wound down — asked about staff-level payments scope." },
];

/**
 * The acquisition channels a new workspace actually has on day one: the
 * ATS/HRIS it already pays for, a CSV someone can drag in, and the intake
 * address its careers inbox forwards to. Each chip carries the size of the
 * backlog it brings so "214 applications became a ranked, explained 12 by
 * morning" is a number the screen owns, not a slogan.
 *
 * The forwarding inbox runs the same import — copying an address that never
 * produces an arrival is a channel a recruiter can't tell is working. Its
 * count is smaller because a forwarded inbox is a trickle, not an ATS export.
 */
const IMPORT_SOURCES: { id: ImportSource; label: string; kind: string; received: number }[] = [
  { id: "Greenhouse", label: "Greenhouse", kind: "ATS", received: 214 },
  { id: "Lever", label: "Lever", kind: "ATS", received: 96 },
  { id: "SeamlessHR", label: "SeamlessHR", kind: "HRIS", received: 148 },
  { id: "CSV", label: "CSV / spreadsheet", kind: "File", received: 214 },
  { id: "Forwarding email", label: "Forwarding email", kind: "Inbox", received: 38 },
];

/** How many of an import land in the pipeline board immediately (the rest screen overnight). */
const PIPELINE_BATCH = 20;

/* Name pool for generated applicant records — plausible, unique, Nigerian. */
const IMP_FIRST = ["Adaeze", "Chinedu", "Fatima", "Emeka", "Zainab", "Tunde", "Ngozi", "Ibrahim", "Chioma", "Segun", "Amina", "Kelechi", "Yetunde", "Musa", "Blessing", "Obinna", "Halima", "Femi", "Uche", "Aisha", "Damilola", "Nnamdi", "Rukayat", "Bayo"];
const IMP_LAST = ["Okonkwo", "Adeyemi", "Balogun", "Nwosu", "Ibrahim", "Eze", "Okafor", "Bello", "Ogundipe", "Abubakar", "Chukwu", "Lawal", "Onyeka", "Sanusi", "Ademola", "Uzoma", "Yakubu", "Afolabi", "Nwankwo", "Oyelaran", "Danjuma", "Ikpeazu", "Salami", "Obi"];
const IMP_TONES = ["#16B364", "#AF52DE", "#007AFF", "#EBA308", "#475569", "#E81E17"];

/** Deterministic, collision-free against whoever is already in the pipeline. */
function generateApplicants(n: number, role: string, source: string, taken: Set<string>): DirCandidate[] {
  const out: DirCandidate[] = [];
  for (let i = 0; out.length < n && i < IMP_FIRST.length * IMP_LAST.length; i++) {
    const first = IMP_FIRST[i % IMP_FIRST.length];
    const last = IMP_LAST[(i * 7 + 3) % IMP_LAST.length];
    const name = `${first} ${last}`;
    if (taken.has(name)) continue;
    taken.add(name);
    out.push({
      name,
      init: `${first[0]}${last[0]}`,
      tone: IMP_TONES[i % IMP_TONES.length],
      role,
      stage: "Screening",
      score: 58 + ((i * 13) % 34),
      source,
    });
  }
  return out;
}

const isAuto = (p: Pool) => /auto|fed by/i.test(p.note);

/* ------------------------------ Small pieces ------------------------------ */

function CheckBox({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      aria-label={on ? "Deselect" : "Select"}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 17, height: 17, borderRadius: 5, padding: 0, cursor: "pointer", flex: "none",
        border: `1.5px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n300)"}`,
        background: on ? "var(--pf-primary-500)" : "var(--pf-n0)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      {on && <Ic name="check" size={11} color="#fff" weight={2.8} />}
    </button>
  );
}

function SrcChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
        border: `1px solid ${active ? "var(--pf-n900)" : "var(--pf-n100)"}`,
        background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        color: active ? "#fff" : "var(--pf-n500)", whiteSpace: "nowrap", lineHeight: 1.3,
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------- Pool card -------------------------------- */

function PoolCard({ p, selected, onOpen, onDots }: { p: Pool; selected: boolean; onOpen: () => void; onDots: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        background: "var(--pf-n0)", borderRadius: 12, padding: 16, cursor: "pointer",
        border: `1px solid ${selected ? "var(--pf-primary-500)" : hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`,
        boxShadow: selected ? "0 0 0 3px var(--pf-primary-50)" : hovered ? "0 8px 22px rgba(2,6,23,.07)" : "0 1px 3px 0 #f3f3f3",
        transform: hovered && !selected ? "translateY(-2px)" : "none",
        transition: "box-shadow .15s ease, border-color .15s ease, transform .15s ease",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: `${p.tone}14`, color: p.tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, flex: "none" }}>
          {p.icon}
        </span>
        <span style={{ flex: 1 }} />
        {isAuto(p) && <PfBadge tone="green" dot>AUTO</PfBadge>}
        <button
          aria-label="Pool options"
          onClick={(e) => { e.stopPropagation(); onDots(); }}
          style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: "var(--pf-n400)", display: "flex" }}
        >
          <Ic name="dots" size={16} />
        </button>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", marginTop: 12, lineHeight: 1.3, minHeight: 36 }}>{p.name}</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{p.count}</span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>people</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 12, color: "var(--pf-n500)" }}>
        <Ic name="pulse" size={12} color="var(--pf-primary-500)" />
        {p.fresh}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>{p.note}</div>

      <div style={{ marginTop: 13 }}>
        {selected ? (
          <PfBtn variant="primary" small full icon="check" onClick={onOpen}>Viewing members</PfBtn>
        ) : (
          <PfBtn variant="secondary" small full onClick={onOpen}>Open pool</PfBtn>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Member row ------------------------------- */

const MEMBER_COLS = "30px minmax(190px,1.6fr) 0.8fr 1.1fr 1fr 200px";

function MemberRow({ c, last, checked, onToggle, onSequence, onView }: {
  c: ShortlistCandidate; last: boolean; checked: boolean;
  onToggle: () => void; onSequence: () => void; onView: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const meta = MEMBER_META[c.name] ?? { last: "—", lastTone: "grey" as PfTone, src: "Talent pool", srcTone: "grey" as PfTone, match: 70 };
  return (
    <div
      {...hoverProps}
      onClick={onToggle}
      style={{
        display: "grid", gridTemplateColumns: MEMBER_COLS, gap: 12, alignItems: "center",
        padding: "10px 20px", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: checked ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "transparent",
        transition: "background .12s ease",
      }}
    >
      <CheckBox on={checked} onToggle={onToggle} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PfAvatar init={c.init} tone={c.tone} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title} · {c.co}</div>
        </div>
      </div>
      <div><PfBadge tone={meta.lastTone} dot>{meta.last}</PfBadge></div>
      <div><PfBadge tone={meta.srcTone}>{meta.src}</PfBadge></div>
      <div><PfBadge tone={matchTone(meta.match)}>{meta.match}% match</PfBadge></div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <PfBtn variant="secondary" small icon="paperplane" onClick={onSequence}>Add to sequence</PfBtn>
        <PfBtn variant="ghost" small onClick={onView}>View</PfBtn>
      </div>
    </div>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function TalentLibrary() {
  const go = useGo();
  const toast = useToast();
  const { roles, candidates, addCandidate } = useLifecycle();
  const { workspace, recordImport, markDone, lastImport } = useWorkspace();

  /* Section tab */
  const [tab, setTab] = useState("pools");

  /* Pools + selection (default: Silver medalists) */
  const [pools, setPools] = useState<Pool[]>(POOLS);
  const [selIdx, setSelIdx] = useState(1);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  /* New-pool inline create */
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  /* ---------------------------- Backlog import ---------------------------- */

  const [atsSrc, setAtsSrc] = useState<ImportSource>("Greenhouse");
  const [importing, setImporting] = useState(false);
  const [importPct, setImportPct] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [csvFile, setCsvFile] = useState<{ name: string; rows: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ received: number; imported: number; merged: number; queued: number; role: string } | null>(null);

  /** Roles an application can land ON — open roles first, plus anything already in the pipeline. */
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    roles.forEach((r) => set.add(r.title));
    candidates.forEach((c) => set.add(c.role));
    return Array.from(set);
  }, [roles, candidates]);

  const [targetRole, setTargetRole] = useState<string>("");
  const role = targetRole || (roleOptions.includes(lastImport.targetRole) ? lastImport.targetRole : roleOptions[0] ?? "");

  const srcDef = IMPORT_SOURCES.find((s) => s.id === atsSrc) ?? IMPORT_SOURCES[0];
  const received = atsSrc === "CSV" && csvFile ? csvFile.rows : srcDef.received;

  const verified = workspace.state === "verified";

  /** Prefix and verified domain are the workspace's own — never the seeded org's. */
  const forwarding = useMemo(() => forwardingFor(workspace), [workspace]);
  const inboxWaiting = IMPORT_SOURCES.find((s) => s.id === "Forwarding email")?.received ?? 0;

  useEffect(() => {
    if (!importing) return;
    const t = setInterval(() => setImportPct((p) => Math.min(100, p + 3 + Math.random() * 7)), 95);
    return () => clearInterval(t);
  }, [importing]);

  useEffect(() => {
    if (!importing || importPct < 100) return;
    setImporting(false);
    setImportDone(true);

    /* The applications become REAL records: merged by identity resolution,
       landed on a role, and written into the pipeline the rest of the app
       reads — Jobs.applicantsFor(), the Candidates kanban, the Dashboard
       counts and the audit log all move. */
    // 214 → 212 kept, 14 merged: the exact result card this tab has always shown.
    const merged = Math.max(1, Math.round(received * 0.065));
    const kept = Math.max(1, received - 2); // 2 rejected — unreadable file or missing consent
    const queued = Math.min(PIPELINE_BATCH, kept);
    const taken = new Set(candidates.map((c) => c.name));
    const srcLabel = atsSrc === "CSV" ? "CSV" : atsSrc;
    generateApplicants(queued, role, srcLabel, taken).forEach((c) => addCandidate(c, `Backlog import · ${srcLabel}`));

    recordImport({
      id: `IMP-${String(Date.now()).slice(-4)}`,
      source: atsSrc,
      targetRole: role,
      received,
      imported: kept,
      merged,
      consentPreserved: kept,
      at: new Date().toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    });
    markDone("import");
    setResult({ received, imported: kept, merged, queued, role });
    toast(`${srcLabel} import complete — ${kept} applications on ${role}; AI merged ${merged} duplicates, every merge logged & reversible`, "ai");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importing, importPct]);

  const totalPeople = useMemo(() => pools.reduce((s, p) => s + p.count, 0), [pools]);
  const autoCount = useMemo(() => pools.filter(isAuto).length, [pools]);

  const sel = pools[selIdx];

  /** Member rows: rotate the shared shortlist per pool so each pool reads distinct. */
  const members = useMemo(() => {
    if (!sel || sel.count === 0) return [] as ShortlistCandidate[];
    const rot = selIdx === 1 ? 0 : (selIdx * 3) % SHORTLIST.length;
    return SHORTLIST.map((_, i) => SHORTLIST[(i + rot) % SHORTLIST.length]);
  }, [sel, selIdx]);

  const openPool = (i: number) => {
    setSelIdx(i);
    setChecked(new Set());
    toast(`Opened pool — ${pools[i].name} (${pools[i].count} people)`);
  };

  const toggle = (name: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const allChecked = members.length > 0 && members.every((m) => checked.has(m.name));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(members.map((m) => m.name)));

  const createPool = () => {
    const name = newName.trim();
    if (!name) return;
    const next: Pool = { name, count: 0, fresh: "New — no members yet", icon: "✦", tone: "#16B364", note: "Manual pool" };
    setPools((p) => [...p, next]);
    setSelIdx(pools.length);
    setChecked(new Set());
    setAdding(false);
    setNewName("");
    toast(`Pool "${name}" created — feed it from stages, imports or a saved search`, "success");
  };

  const runImport = () => {
    if (importing) return;
    if (!role) { toast("Pick the role these applications belong to first", "default"); return; }
    if (atsSrc === "CSV" && !csvFile) { toast("Drop a CSV in, or pick an ATS to pull from", "default"); return; }
    // We won't accept CVs on behalf of an employer we haven't checked — the
    // same rule the inbox card states, enforced where it can be broken.
    if (atsSrc === "Forwarding email" && !verified) { toast(forwarding.unverifiedNote, "default"); return; }
    setImportDone(false);
    setResult(null);
    setImportPct(0);
    setImporting(true);
  };

  /** A dropped file is read for its row count — the import is sized by the real file. */
  const takeFile = (f: File | null | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = Math.max(1, text.split(/\r?\n/).filter((l) => l.trim()).length - 1);
      setCsvFile({ name: f.name, rows });
      toast(`${f.name} read — ${rows} rows, header detected. Pick the role and import.`, "success");
    };
    reader.onerror = () => toast("That file couldn't be read — export it as CSV and try again", "danger");
    reader.readAsText(f);
  };

  const importStage =
    importPct < 34
      ? atsSrc === "Forwarding email"
        ? "Reading what's landed in your application inbox…"
        : `Pulling profiles from ${atsSrc}…`
    : importPct < 72 ? "Resolving identities — email + phone + fuzzy name…"
    : "Merging duplicates · preserving consent states…";

  const nSel = checked.size;
  const bulk = (msg: string, tone?: "success" | "ai") => {
    toast(msg, tone);
    setChecked(new Set());
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0, lineHeight: 1.2 }}>Talent Library</h1>
            <PfBadge tone="green">{totalPeople} in library</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Named pools with freshness — silver medalists, campus, alumni and imports, deduped into one CRM.
          </div>
        </div>
        <PfBtn variant="secondary" icon="search" onClick={() => toast("Saved searches — “Sr. designers · Lagos · active <90d” + 2 more run live inside this library")}>
          Saved searches (3)
        </PfBtn>
      </div>

      {/* ONE CRM banner — page-wide, stays above the section bar */}
      <div style={{ marginTop: 16 }}>
        <PfBanner
          tone="green"
          icon="stack"
          cta="open"
          onCta={() => toast("One CRM — every profile here shares the single record spine (candidate ↔ employee ↔ alumni)")}
        >
          Pools and people in one place — saved searches live here too; there is no separate contacts list (PRD §7).
        </PfBanner>
      </div>

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "pools", label: "Pools & members", count: String(pools.length) },
            { key: "import", label: "Import backlog", badge: "AHA" },
            { key: "boomerang", label: "Boomerang", count: String(BOOMERANG.length) },
          ]}
        />
      </div>

      {/* POOLS & MEMBERS */}
      {tab === "pools" && (
      <>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat icon="users" tone="green" label="People in library" value={totalPeople} unit={`across ${pools.length} pools`} />
        <PfStat icon="stack" tone="blue" label="Pools" value={pools.length} unit={`${autoCount} auto-fed`} />
        <PfStat icon="pulse" tone="purple" label="Active < 90d" value="68%" unit="library freshness" delta="+6pp" />
        <PfStat icon="swap" tone="yellow" label="Deduped this month" value={14} unit="email + phone + fuzzy name" />
      </div>

      {/* Pool grid */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600, color: "var(--pf-n900)" }}>Pools</span>
        <PfBadge tone="grey">{pools.length}</PfBadge>
        <span style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n400)" }}>
          <PfBadge tone="green" dot>AUTO</PfBadge> = auto-fed, no manual upkeep
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 10 }}>
        {pools.map((p, i) => (
          <PoolCard
            key={p.name}
            p={p}
            selected={i === selIdx}
            onOpen={() => openPool(i)}
            onDots={() => toast(`Pool options — rename, share or archive “${p.name}”`)}
          />
        ))}

        {/* + New pool */}
        {adding ? (
          <div style={{ background: "var(--pf-n0)", border: "1.5px dashed var(--pf-n300)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10, animation: "scIn .18s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PfTile icon="plus" tone="green" size={30} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Name the new pool</span>
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createPool(); if (e.key === "Escape") setAdding(false); }}
              placeholder="e.g. Data engineers — Abuja"
              style={{ border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 11px", fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", outline: "none", background: "var(--pf-n0)", width: "100%" }}
            />
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Feed it from stage rules, imports or a saved search after creating.</div>
            <span style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <PfBtn variant="primary" small icon="check" onClick={createPool} style={{ opacity: newName.trim() ? 1 : 0.5 }}>Create pool</PfBtn>
              <PfBtn variant="ghost" small icon="x" onClick={() => { setAdding(false); setNewName(""); }}>Cancel</PfBtn>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              background: "var(--pf-n25)", border: "1.5px dashed var(--pf-n300)", borderRadius: 12, padding: 16,
              cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 8, minHeight: 190, color: "var(--pf-n500)",
            }}
          >
            <PfTile icon="plus" tone="green" size={34} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>New pool</span>
            <span style={{ fontSize: 12, color: "var(--pf-n400)", maxWidth: 210, lineHeight: 1.45 }}>
              Named pools with member counts & freshness — campus drives, events, role families.
            </span>
          </button>
        )}
      </div>

      {/* Selected pool member list */}
      {sel && (
        <div style={{ marginTop: 12 }}>
          <PfCard>
            <PfCardHead
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {sel.name}
                  {isAuto(sel) && <PfBadge tone="green" dot>AUTO</PfBadge>}
                </span>
              }
              sub={`${sel.count} people · ${sel.fresh} · ${sel.note}`}
            >
              <PfBtn variant="secondary" small icon="filter" onClick={() => toast("Member filters — source, last-active window, match % (demo)")}>Filter</PfBtn>
            </PfCardHead>

            {members.length === 0 ? (
              <div style={{ padding: "38px 24px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><PfTile icon="users" tone="grey" size={38} /></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 3 }}>No members yet</div>
                <div style={{ fontSize: 13, color: "var(--pf-n400)", marginBottom: 14 }}>
                  Feed &ldquo;{sel.name}&rdquo; from stage rules, an ATS import below, or a saved search.
                </div>
                <PfBtn variant="secondary" icon="gear" onClick={() => toast(`Feed rules for “${sel.name}” — pick stages, imports or a saved search (demo)`)}>
                  Set up auto-feed
                </PfBtn>
              </div>
            ) : (
              <>
                {/* Bulk action bar */}
                {nSel > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: "var(--pf-primary-50)", borderBottom: "1px solid var(--pf-primary-100)", animation: "scIn .15s ease", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-500)" }}>{nSel} selected</span>
                    <span style={{ flex: 1 }} />
                    <PfBtn variant="primary" small icon="paperplane" onClick={() => bulk(`Added ${nSel} to “Sr. Product Designer — warm pool” sequence — first-touch drafts ready for your review`, "success")}>
                      Add {nSel} to sequence
                    </PfBtn>
                    <PfBtn variant="secondary" small icon="swap" onClick={() => bulk(`Moved ${nSel} to “Product Design — role family” — counts & freshness recalculated`, "success")}>
                      Move to pool
                    </PfBtn>
                    <PfBtn variant="secondary" small icon="download" onClick={() => bulk(`Exported ${nSel} profiles to CSV — consent columns included (NDPR)`)}>
                      Export CSV
                    </PfBtn>
                    <PfBtn variant="ghost" small icon="x" onClick={() => setChecked(new Set())}>Clear</PfBtn>
                  </div>
                )}

                {/* Table header */}
                <div style={{ display: "grid", gridTemplateColumns: MEMBER_COLS, gap: 12, alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                  <CheckBox on={allChecked} onToggle={toggleAll} />
                  <PfTh>Person</PfTh>
                  <PfTh>Last active</PfTh>
                  <PfTh>Source</PfTh>
                  <PfTh>Match to open roles</PfTh>
                  <PfTh style={{ textAlign: "right" }}></PfTh>
                </div>

                {members.map((c, i) => (
                  <MemberRow
                    key={c.name}
                    c={c}
                    last={i === members.length - 1}
                    checked={checked.has(c.name)}
                    onToggle={() => toggle(c.name)}
                    onSequence={() => { toast(`${c.name} added to “Sr. Product Designer — warm pool” — opening Sequences`, "success"); go("sequences"); }}
                    onView={() => toast(`Profile preview — ${c.name} (${c.title} · ${c.co})`)}
                  />
                ))}

                <div style={{ padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
                  Showing {members.length} of {sel.count} — identity-resolved; consent states travel with each profile.
                </div>
              </>
            )}
          </PfCard>
        </div>
      )}
      </>
      )}

      {/* IMPORT BACKLOG — the aha moment: applications you already own, ranked by morning */}
      {tab === "import" && (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 1.25fr) minmax(300px, 1fr)", gap: 12, alignItems: "start" }}>
        <PfCard>
          <PfCardHead title="Import the backlog you already have" sub={BACKLOG_PROMISE}>
            <PfBadge tone="blue">Identity resolution</PfBadge>
          </PfCardHead>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
            {/* Source */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 7 }}>WHERE IT LIVES TODAY</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {IMPORT_SOURCES.map((s) => (
                  <SrcChip key={s.id} label={`${s.label} · ${s.kind}`} active={atsSrc === s.id} onClick={() => setAtsSrc(s.id)} />
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6 }}>
                {HRIS_SOURCES.slice(1).join(", ")} land through the same flow — connect them in Integrations and they appear here.
              </div>
            </div>

            {/* CSV drop zone — the app's only file input, and it reads the real file */}
            {atsSrc === "CSV" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `1.5px dashed ${dragOver ? "var(--pf-primary-500)" : "var(--pf-n300)"}`,
                  background: dragOver ? "var(--pf-primary-50)" : "var(--pf-n25)",
                  borderRadius: 12, padding: "20px 18px", textAlign: "center", cursor: "pointer", animation: "scIn .15s ease",
                }}
              >
                <input
                  ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: "none" }}
                  onChange={(e) => takeFile(e.target.files?.[0])}
                />
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><PfTile icon="download" tone={csvFile ? "green" : "grey"} size={34} /></div>
                {csvFile ? (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{csvFile.name}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{csvFile.rows} rows · header detected · click to swap the file</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Drop a CSV here</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>
                      Name, email, phone, role, consent — any column order. We read the header and map it.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Target role — imports land ON a role, not in a pool */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 7 }}>LAND THESE APPLICATIONS ON</div>
              <select
                value={role}
                onChange={(e) => setTargetRole(e.target.value)}
                style={{ width: "100%", fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "9px 11px", cursor: "pointer" }}
              >
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6 }}>
                They become applicants on this role — not names in a pool. The library keeps a copy either way.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <PfBtn variant="primary" icon="download" onClick={runImport} style={{ opacity: importing ? 0.6 : 1 }}>
                {importing ? "Importing…" : importDone ? "Import again" : `Import ${received} applications`}
              </PfBtn>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Nothing is contacted — importing is not outreach.</span>
            </div>

            {importing && (
              <div style={{ animation: "scIn .15s ease" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 12.5, color: "var(--pf-n500)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-primary-500)", animation: "pulseDot 1s infinite" }} />
                    {importStage}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{Math.round(importPct)}%</span>
                </div>
                <PfProgress pct={importPct} />
              </div>
            )}

            {importDone && !importing && result && (
              <div style={{ display: "flex", flexDirection: "column", gap: 11, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "12px 14px", animation: "scIn .18s ease" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Ic name="check" size={16} color="var(--pf-primary-500)" weight={2.2} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-primary-500)" }}>
                      {result.imported} imported · {result.merged} duplicates merged by identity resolution (email + phone + fuzzy name) · consent states preserved
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.5 }}>
                      {result.queued} are already on the <b>{result.role}</b> board at Screening; the rest are queued for tonight&apos;s run.
                    </div>
                    <button
                      onClick={() => toast(`Merge log — ${result.merged} merges, each reversible with a full audit trail (AI proposed, you dispose)`)}
                      style={{ background: "none", border: "none", padding: 0, marginTop: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500, color: "var(--pf-n500)", textDecoration: "underline" }}
                    >
                      View merge log
                    </button>
                  </div>
                </div>
                {/* The missing link: the backlog now has somewhere to go tonight. */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="sparkle" tone="var(--pf-purple-500)" onClick={() => go("processing")}>
                    Screen all {result.imported} overnight →
                  </PfBtn>
                  <PfBtn variant="secondary" icon="users" onClick={() => go("candidates")}>See them in the pipeline</PfBtn>
                </div>
              </div>
            )}

            {!importing && !importDone && (
              <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                Last import fed &ldquo;{lastImport.targetRole}&rdquo; — {lastImport.imported} kept after dedupe, ranked by {lastImport.screenedAt ?? "morning"}.
                Duplicates merge into the existing record; nothing is double-contacted.
              </div>
            )}
          </div>
        </PfCard>

        {/* FORWARDING ADDRESS — an acquisition channel, beside the connectors rather
            than buried in an API-keys page, and wired to the same import as the ATS
            chips: an address that never produces an arrival proves nothing. */}
        <PfCard>
          <PfCardHead title="Your application inbox" sub="Point your careers inbox here once — everything in flight starts flowing">
            <PfBadge tone={verified ? "green" : "yellow"} dot>{verified ? "Live" : "Pending verification"}</PfBadge>
          </PfCardHead>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: verified ? "var(--pf-n25)" : "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "11px 13px", opacity: verified ? 1 : 0.72 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 5 }}>WORKSPACE ADDRESS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {forwarding.address}
                </span>
                <PfBtn
                  small
                  onClick={() => {
                    try { void navigator.clipboard?.writeText(forwarding.address); } catch {}
                    toast(`Copied ${forwarding.address} — set it as the forward on careers@${forwarding.verifiedDomain}`, "success");
                  }}
                >
                  Copy
                </PfBtn>
              </div>
            </div>

            {role && (
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "11px 13px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 5 }}>ALIAS FOR {role.toUpperCase()}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {forwarding.aliasFor(role)}
                  </span>
                  <PfBtn
                    small
                    onClick={() => {
                      try { void navigator.clipboard?.writeText(forwarding.aliasFor(role)); } catch {}
                      toast(`Alias copied — anything sent here lands on ${role} automatically`, "success");
                    }}
                  >
                    Copy
                  </PfBtn>
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 7 }}>WHAT LANDS HERE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {forwarding.lands.map((l) => (
                  <div key={l} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {verified && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <PfBtn
                  variant="secondary"
                  icon="download"
                  small
                  onClick={() => { setAtsSrc("Forwarding email"); toast(`${inboxWaiting} already waiting in the inbox — pick the role and import them`, "default"); }}
                >
                  Import the {inboxWaiting} already waiting
                </PfBtn>
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Same dedupe, same consent rules as an ATS pull.</span>
              </div>
            )}

            <div style={{ background: verified ? "var(--pf-primary-50)" : "var(--pf-yellow-50)", border: `1px solid ${verified ? "var(--pf-primary-100)" : "var(--pf-yellow-100)"}`, borderRadius: 10, padding: "10px 13px", fontSize: 11.5, lineHeight: 1.55, color: "var(--pf-n600)" }}>
              {verified ? forwarding.note : forwarding.unverifiedNote}
            </div>
          </div>
        </PfCard>
      </div>
      )}

      {/* BOOMERANG */}
      {tab === "boomerang" && (
      <div style={{ maxWidth: 720 }}>
        <PfCard>
          <PfCardHead title="Boomerang spotlight" sub="Alumni open to return — fed by FR-063 offboarding.">
            <PfBadge tone="yellow">↻ 21 alumni</PfBadge>
          </PfCardHead>
          <div style={{ padding: "12px 20px 6px" }}>
            {BOOMERANG.map((a, i) => (
              <div key={a.name} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 0", borderBottom: i === BOOMERANG.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfAvatar init={a.init} tone={a.tone} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.name}</span>
                    <PfBadge tone="green" dot>Open to return</PfBadge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 2 }}>{a.role} · {a.left}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.45 }}>{a.note}</div>
                </div>
                <PfBtn
                  variant="secondary"
                  small
                  icon="paperplane"
                  onClick={() => { toast(`Re-engage ${a.name} — alumni sequence draft opened (warm intro, not a cold template)`, "success"); go("sequences"); }}
                >
                  Re-engage
                </PfBtn>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
            Only alumni who opted in at offboarding appear here — exit-interview consent respected (NDPR).
          </div>
        </PfCard>
      </div>
      )}
    </div>
  );
}
