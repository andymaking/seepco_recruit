"use client";
import { useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe, type Correction } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfAvatar,
  PfPageTabs, PfTh, PfBanner, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_SKIP, MY_SQUAD, MY_PROFILE_FIELDS, MY_DOCS,
  MY_RETENTION_NOTE, MY_PAYSLIPS, MY_HANDBOOK, MY_VISIBILITY, MY_CONSENT,
} from "@/data/me";

/**
 * Your profile & documents (route /my-profile) — the subject's side of her own
 * record (FR-080).
 *
 * EmployeeRecord.tsx is the employer's read of this same person: it opens with
 * her leave-risk tier, her performance and engagement scores, and a team panel
 * of colleagues. None of that is hers, so none of it is here. What IS hers: the
 * nine fields an HRIS import wrote about her without asking, the one it got
 * wrong, the documents she signed, and the honest answer about where her money
 * actually lives.
 *
 * Two things this page deliberately refuses to render:
 *   · a pay figure of any kind — payroll is OFFSITE in this app's model, so the
 *     index (period + issue date) is all Hirebrew legitimately holds, and an
 *     outbound rail to SeamlessHR is the truthful surface. A benefits or
 *     balance widget here would be a fiction dressed as a feature;
 *   · a team roster. Her squad exists (MY_SQUAD is a string), but her
 *     colleagues' records are theirs. Manager and skip only.
 *
 * The correction flow is the point of the Profile tab. Nothing on this page was
 * typed by her, so every row has to be challengeable — and a correction raises a
 * change request with People Ops rather than silently overwriting the record.
 * Writes go through useMe().submitCorrection.
 */

/* ---------------------------------- types ---------------------------------- */

type ProfileField = { field: string; imported: string; correct?: string; wrong?: boolean };

type Policy = { id: string; section: string; title: string; owner: string; updated: string; body: string };

type PolicyMeta = { icon: string; tone: PfTone; cta?: string };

/* ------------------------------ derived data ------------------------------- */

const FIELDS: ProfileField[] = MY_PROFILE_FIELDS;

/** The row the import got wrong — Grade L4, when her record and her v2 contract both say L5. */
const FLAGGED = FIELDS.filter((f) => f.wrong);

const EMAIL = FIELDS.find((f) => f.field === "Work email")?.imported ?? "";

/** Documents she can act on, with the reason each one exists on her record. */
const DOC_WHY: Record<string, string> = {
  "Offer letter — signed": "Carried across from your offer — the same document you signed before day one.",
  "Employment contract v2 (L5 promotion)": "Reissued when you were promoted to L5 in May 2025. It is the current one.",
  "NDA & IP assignment": "Signed at hire. It runs for as long as your record does.",
};

const DOC_STATE: Record<string, { label: string; tone: PfTone }> = {
  "Offer letter — signed": { label: "Signed", tone: "green" },
  "Employment contract v2 (L5 promotion)": { label: "Current", tone: "blue" },
  "NDA & IP assignment": { label: "Signed", tone: "green" },
};

/** Row 9 of the transparency matrix — the one that says your manager never sees your slip. */
const PAY_VIS = MY_VISIBILITY.find((r) => r.item === "Your payslip and pay band");

/** Clause c3 — bank and pension details, lawful basis "Legal obligation", accepted Nov 2023. */
const PAYROLL_CLAUSE = MY_CONSENT.clauses.find((c) => c.id === "c3");

/** Payroll first, then leave — the two people actually come here for. */
const POLICY_ORDER = ["hb-payroll", "hb-leave", "hb-expenses", "hb-remote", "hb-devices"];

const POLICIES: Policy[] = POLICY_ORDER
  .map((id) => MY_HANDBOOK.find((h) => h.id === id))
  .filter((h): h is Policy => Boolean(h));

const POLICY_META: Record<string, PolicyMeta> = {
  "hb-payroll": { icon: "wallet", tone: "green", cta: "Open payslips in SeamlessHR ↗" },
  "hb-leave": { icon: "calendar", tone: "blue", cta: "Request leave in SeamlessHR ↗" },
  "hb-expenses": { icon: "file", tone: "yellow", cta: "Claim in SeamlessHR ↗" },
  "hb-remote": { icon: "house", tone: "purple" },
  "hb-devices": { icon: "shield", tone: "grey" },
};

const SECTION_TONE: Record<string, PfTone> = {
  Money: "green", Time: "blue", "Ways of working": "purple",
};

/**
 * Handbook docs carry an owning individual ("Finance · Kemi Salami"). A Me page
 * names her manager, her skip and the People Ops officer on her own consent
 * record — nobody else — so policies are attributed to the owning TEAM here.
 */
const teamOf = (owner: string) => owner.split(" · ")[0];

const AGENDA_ITEM = "Office days for the payments squad — which days are we in?";

/* ------------------------------- shared style ------------------------------ */

const chipBtn = {
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
  fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)",
  border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer",
} as const;

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none",
} as const;

const footNote = {
  display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)",
  borderTop: "1px solid var(--pf-n50)", borderRadius: "0 0 12px 12px", fontSize: 12, color: "var(--pf-n400)",
} as const;

const GRID = "148px minmax(0,1fr) auto";

/* --------------------------------- skill chip ------------------------------ */

function SkillChip({ skill, onClick }: { skill: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title="Same skill taxonomy as your growth plan"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500,
        color: hovered ? "var(--pf-n900)" : "var(--pf-n500)", background: hovered ? "var(--pf-n100)" : "var(--pf-n50)",
        border: "0.6px solid var(--pf-n100)", borderRadius: 999, padding: "3px 9px", cursor: "pointer",
        whiteSpace: "nowrap", lineHeight: 1.35,
      }}
    >
      <Ic name="graph" size={11} />
      {skill}
    </button>
  );
}

/* ------------------------------ reporting line ----------------------------- */

function ReportRow({ person, rel, action, onAction, last }: {
  person: { name: string; init: string; tone: string; role: string };
  rel: string; action: string; onAction: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 20px",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <PfAvatar init={person.init} tone={person.tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{person.name}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{person.role}</div>
      </div>
      <PfBadge tone="grey">{rel}</PfBadge>
      <PfBtn small variant="secondary" onClick={onAction}>{action}</PfBtn>
    </div>
  );
}

/* ------------------------------- imported field ---------------------------- */

function FieldRow({ f, submitted, editing, draft, onDraft, onOpen, onCancel, onSave, last }: {
  f: ProfileField; submitted?: Correction; editing: boolean; draft: string;
  onDraft: (v: string) => void; onOpen: () => void; onCancel: () => void; onSave: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  const flagged = Boolean(f.wrong) && !submitted;
  return (
    <div
      {...hoverProps}
      style={{
        padding: "12px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: flagged ? "var(--pf-yellow-50)" : hovered ? "var(--pf-n25)" : "transparent",
        transition: "background .12s ease",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{f.field}</span>

        <div style={{ minWidth: 0 }}>
          {submitted ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{submitted.to}</span>
              <span style={{ fontSize: 12, color: "var(--pf-n300)", textDecoration: "line-through" }}>{submitted.from}</span>
              <PfBadge tone="blue" dot>Change request · People Ops</PfBadge>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: flagged ? "var(--pf-n500)" : "var(--pf-n900)", textDecoration: flagged ? "line-through" : "none" }}>
                {f.imported}
              </span>
              {flagged && <PfBadge tone="yellow" dot>Does not match your record</PfBadge>}
            </div>
          )}
          {flagged && !editing && (
            <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.5 }}>
              Your record and your May 2025 contract v2 both say <strong style={{ color: "var(--pf-n900)" }}>{f.correct}</strong> — the import
              still carries {f.imported}. Correcting it raises a change request; it never silently overwrites you.
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {submitted ? (
            <PfBadge tone="grey">{submitted.at}</PfBadge>
          ) : editing ? (
            <PfBtn small variant="ghost" onClick={onCancel}>Cancel</PfBtn>
          ) : (
            <PfBtn small variant={flagged ? "primary" : "secondary"} onClick={onOpen}>
              {flagged ? "Correct this" : "Correct"}
            </PfBtn>
          )}
        </div>
      </div>

      {editing && !submitted && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: 10 }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
            placeholder={`The correct ${f.field.toLowerCase()}`}
            style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
          />
          <PfBtn small variant="primary" onClick={onSave}>Raise change request</PfBtn>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- document -------------------------------- */

function DocRow({ doc, last, onOpen, onDownload, onProvenance }: {
  doc: { icon: string; name: string; meta: string }; last: boolean;
  onOpen: () => void; onDownload: () => void; onProvenance?: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const state = DOC_STATE[doc.name];
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <PfTile icon={doc.icon} tone={doc.icon === "shield" ? "purple" : "blue"} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{doc.name}</span>
          {state && <PfBadge tone={state.tone}>{state.label}</PfBadge>}
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{doc.meta}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>{DOC_WHY[doc.name]}</div>
        {onProvenance && (
          <button onClick={onProvenance} title="One record — the promotion that reissued this document is on your journey" style={{ ...chipBtn, marginTop: 7 }}>
            ✦ from your May 2025 promotion
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flex: "none" }}>
        <PfBtn small variant="secondary" onClick={onOpen}>Open</PfBtn>
        <PfBtn small variant="secondary" icon="download" onClick={onDownload}>PDF</PfBtn>
      </div>
    </div>
  );
}

/* --------------------------------- payslip --------------------------------- */

function PayslipRow({ p, last, onOpen }: {
  p: { period: string; state: string; at: string }; last: boolean; onOpen: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 140px auto", alignItems: "center", gap: 12,
        padding: "13px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PfTile icon="wallet" tone="green" size={30} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{p.period}</span>
      </div>
      <PfBadge tone="green" dot>{p.state}</PfBadge>
      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Issued {p.at}</span>
      <PfBtn small variant="secondary" icon="arrowsq" onClick={onOpen}>Open in SeamlessHR ↗</PfBtn>
    </div>
  );
}

/* -------------------------------- policy card ------------------------------ */

function PolicyCard({ p, open, onToggle, onCta, extra }: {
  p: Policy; open: boolean; onToggle: () => void; onCta?: () => void; extra?: ReactNode;
}) {
  const { hovered, hoverProps } = useHover();
  const meta = POLICY_META[p.id] ?? { icon: "book", tone: "grey" as PfTone };
  return (
    <PfCard style={{ alignSelf: "start" }}>
      <button
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
          fontFamily: "inherit", background: hovered ? "var(--pf-n25)" : "transparent", border: "none",
          padding: "14px 16px", cursor: "pointer", borderRadius: open ? "12px 12px 0 0" : 12,
          transition: "background .12s ease",
        }}
      >
        <PfTile icon={meta.icon} tone={meta.tone} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{p.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
            {teamOf(p.owner)} · updated {p.updated}
          </div>
        </div>
        <PfBadge tone={SECTION_TONE[p.section] ?? "grey"}>{p.section}</PfBadge>
        <Ic name={open ? "caretdown" : "caretright"} size={15} color="var(--pf-n300)" />
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--pf-n50)" }}>
          <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 12 }}>{p.body}</div>
          {extra}
          {onCta && meta.cta && (
            <div style={{ marginTop: 11 }}>
              <PfBtn small variant="secondary" icon="arrowsq" onClick={onCta}>{meta.cta}</PfBtn>
            </div>
          )}
        </div>
      )}
    </PfCard>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function MyProfile() {
  const go = useGo();
  const toast = useToast();
  const me = useMe();

  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [openDocs, setOpenDocs] = useState<string[]>(["hb-payroll", "hb-leave"]);
  const [agendaAdded, setAgendaAdded] = useState(false);

  const submittedFor = (field: string): Correction | undefined => me.corrections.find((c) => c.field === field);

  /** A flagged field stops being flagged once you have raised the change request. */
  const openFlagged = FLAGGED.filter((f) => !submittedFor(f.field)).length;

  const openEdit = (f: ProfileField) => {
    setEditing(f.field);
    setDraft(f.correct ?? f.imported);
  };

  const saveEdit = (f: ProfileField) => {
    const to = draft.trim();
    if (!to) { toast("Type the correct value first — a blank change request cannot be reviewed"); return; }
    if (to === f.imported) { toast(`That is what your record already says for ${f.field} — nothing to correct`); return; }
    me.submitCorrection(f.field, f.imported, to);
    setEditing(null);
    toast(`Change request raised — ${f.field}: ${f.imported} → ${to}. People Ops reviews it; your record is unchanged until they do.`, "success");
  };

  const togglePolicy = (id: string) =>
    setOpenDocs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addRemoteToAgenda = () => {
    if (agendaAdded) { go("myoneonones"); return; }
    me.addAgendaItem(AGENDA_ITEM);
    setAgendaAdded(true);
    toast(`Added to your next 1-on-1 with ${MY_MANAGER.name} — “${AGENDA_ITEM}”`, "success");
  };

  const outbound = (what: string) =>
    toast(`Opening ${what} in SeamlessHR — a secure tab. Hirebrew never holds the amounts.`, "success");

  const corrections = me.corrections;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your profile &amp; documents</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            What the company holds about you on paper — the fields an import wrote, the documents you signed, and where your
            pay actually lives. Nothing here was typed by you, so anything wrong is yours to correct.
          </div>
        </div>
        <PfBtn variant="secondary" icon="shield" onClick={() => go("myprivacy")}>Who sees what</PfBtn>
        <PfBtn variant="primary" icon="arrowsq" onClick={() => outbound("SeamlessHR")}>SeamlessHR ↗</PfBtn>
      </div>

      {/* KPI strip — every number is about your record, and only yours */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat
          icon="user" tone="green" label="Imported fields" value={FIELDS.length} unit="on your record"
          delta={openFlagged ? `${openFlagged} flagged` : "All confirmed"} deltaTone={openFlagged ? "yellow" : "green"}
        />
        <PfStat
          icon="clipboard" tone="blue" label="Change requests" value={corrections.length} unit="open"
          delta="People Ops reviews" deltaTone="grey"
        />
        <PfStat
          icon="file" tone="purple" label="Documents" value={MY_DOCS.length} unit="on file"
          delta={MY_RETENTION_NOTE} deltaTone="grey"
        />
        <PfStat
          icon="wallet" tone="yellow" label="Payslips" value={MY_PAYSLIPS.length} unit="periods"
          delta="In SeamlessHR" deltaTone="blue"
        />
      </div>

      {/* Page sections */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "profile", label: "Profile" },
            { key: "docs", label: "Documents", count: String(MY_DOCS.length) },
            { key: "pay", label: "Pay & benefits" },
          ]}
        />
      </div>

      {/* ============================== PROFILE ============================== */}
      {tab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Identity header */}
          <PfCard pad={20}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
              <PfAvatar init={ME_PUBLIC.init} tone={ME_PUBLIC.tone} size={62} />
              <div style={{ flex: 1, minWidth: 250 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{ME_PUBLIC.name}</span>
                  <PfBadge tone="green" dot>{ME_PUBLIC.status === "active" ? "Active" : ME_PUBLIC.status}</PfBadge>
                </div>
                <div style={{ fontSize: 13, color: "var(--pf-n500)", marginTop: 4 }}>
                  {ME_PUBLIC.role} · {ME_PUBLIC.dept} · {ME_PUBLIC.loc}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
                  <PfBadge tone="grey">Grade {ME_PUBLIC.grade}</PfBadge>
                  <PfBadge tone="grey">{ME_PUBLIC.tenure} with the company</PfBadge>
                  <PfBadge tone="grey">{ME_PUBLIC.contract}</PfBadge>
                  {ME_PUBLIC.hiredVia && (
                    <button onClick={() => go("mygrowth")} title="One record from hire to today — your journey" style={chipBtn}>
                      ✦ Hired via {ME_PUBLIC.hiredVia}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)", marginRight: 2 }}>Skills on your record</span>
                  {ME_PUBLIC.skills.map((s) => (
                    <SkillChip key={s} skill={s} onClick={() => go("mygrowth")} />
                  ))}
                </div>
              </div>
              <div style={{ borderLeft: "1px solid var(--pf-n50)", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 14, flex: "none", minWidth: 190 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Employee ID</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", marginTop: 3 }}>{ME_PUBLIC.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Work email</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis" }}>{EMAIL}</span>
                    <PfBtn small variant="ghost" onClick={() => toast(`Work email copied — ${EMAIL}`)}>Copy</PfBtn>
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* Reporting line — manager and skip only */}
          <PfCard>
            <PfCardHead
              title="Your reporting line"
              sub="Who you report to, and who they report to."
            >
              <PfBadge tone="grey">{MY_SQUAD}</PfBadge>
            </PfCardHead>
            <ReportRow
              person={MY_MANAGER}
              rel="Your manager"
              action="Your 1-on-1s"
              onAction={() => go("myoneonones")}
              last={false}
            />
            <ReportRow
              person={MY_SKIP}
              rel="Skip-level"
              action="Their feedback"
              onAction={() => go("myfeedback")}
              last
            />
            <div style={footNote}>
              <Ic name="shield" size={13} color="var(--pf-n300)" />
              Your squad is named, not listed — your colleagues&rsquo; records are theirs, not part of yours.
            </div>
          </PfCard>

          {/* Imported fields + correction flow */}
          <PfCard>
            <PfCardHead
              title={`${FIELDS.length} imported fields`}
              sub="These came from the HRIS import that created your record — nothing here was typed by you."
            >
              {openFlagged > 0 && <PfBadge tone="yellow" dot>{openFlagged} looks wrong</PfBadge>}
              {corrections.length > 0 && <PfBadge tone="blue">{corrections.length} change request{corrections.length > 1 ? "s" : ""}</PfBadge>}
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Field</PfTh>
              <PfTh>On your record</PfTh>
              <PfTh style={{ textAlign: "right" }}>Correct it</PfTh>
            </div>

            {FIELDS.map((f, i) => (
              <FieldRow
                key={f.field}
                f={f}
                submitted={submittedFor(f.field)}
                editing={editing === f.field}
                draft={draft}
                onDraft={setDraft}
                onOpen={() => openEdit(f)}
                onCancel={() => setEditing(null)}
                onSave={() => saveEdit(f)}
                last={i === FIELDS.length - 1}
              />
            ))}

            <div style={footNote}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              A correction raises a change request with People Ops — it does not silently overwrite your record, and every one is logged.
            </div>
          </PfCard>

          {/* Change requests she has raised */}
          <PfCard>
            <PfCardHead title="Change requests you have raised" sub="Your side of the record — submitted, timestamped, waiting on a person." />
            {corrections.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "18px 20px" }}>
                <PfTile icon="check" tone="grey" size={32} />
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                  Nothing open. Every field above is yours to challenge — including the ones that look right.
                </div>
              </div>
            ) : (
              corrections.map((c, i) => (
                <div
                  key={`${c.field}-${c.at}-${i}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "13px 20px",
                    borderBottom: i === corrections.length - 1 ? "none" : "1px solid var(--pf-n50)",
                  }}
                >
                  <PfTile icon="clipboard" tone="blue" size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.field}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>
                      <span style={{ textDecoration: "line-through" }}>{c.from}</span>
                      <Ic name="arrowright" size={11} color="var(--pf-n300)" />
                      <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{c.to}</span>
                      <span>· raised {c.at}</span>
                    </div>
                  </div>
                  <PfBadge tone="blue" dot>{c.state}</PfBadge>
                  <PfBtn small variant="secondary" onClick={() => toast(`Change request for ${c.field} is with People Ops — you are notified when it is applied or declined`)}>
                    Track
                  </PfBtn>
                </div>
              ))
            )}
          </PfCard>

          <PfBanner cta="open" onCta={() => go("myprivacy")}>
            <span style={{ fontWeight: 600 }}>Every field on this page has a row in Who sees what — </span>
            <span style={{ fontWeight: 400 }}>including the things the company holds about you that are not shown here.</span>
          </PfBanner>
        </div>
      )}

      {/* ============================= DOCUMENTS ============================= */}
      {tab === "docs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead title="Your documents" sub="Everything you have signed, and the current version of anything reissued.">
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`All ${MY_DOCS.length} of your documents packaged as a PDF bundle — offer, contract v2 and NDA`, "success")}>
                Download all
              </PfBtn>
            </PfCardHead>
            {MY_DOCS.map((d, i) => (
              <DocRow
                key={d.name}
                doc={d}
                last={i === MY_DOCS.length - 1}
                onOpen={() => toast(`Opening “${d.name}” — read-only, watermarked with your name`)}
                onDownload={() => toast(`“${d.name}” downloaded as PDF`, "success")}
                onProvenance={d.name.includes("contract v2") ? () => go("mygrowth") : undefined}
              />
            ))}
            <div style={footNote}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Your offer letter carried across from hiring — one record, not a fresh file at every stage.
            </div>
          </PfCard>

          {/* Retention, stated plainly */}
          <PfCard>
            <PfCardHead title="How long these are kept" sub="The uncomfortable number, said out loud rather than buried in a schedule." />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="clock" tone="yellow" size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Signed documents</span>
                  <PfBadge tone="yellow">{MY_RETENTION_NOTE}</PfBadge>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.6 }}>
                  Your offer, contract and NDA stay on your record for six years after you leave, then they are deleted.
                  That is the statutory schedule for employment records — not a setting anyone can change for you, and not
                  something your manager decides.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px" }}>
              <PfTile icon="shield" tone="green" size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Already deleted</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.6 }}>{MY_CONSENT.retention}</div>
              </div>
              <PfBtn small variant="secondary" onClick={() => go("myprivacy")}>Your consent record</PfBtn>
            </div>
          </PfCard>

          <PfBanner tone="grey" icon="file" cta="open" onCta={() => go("myprivacy")}>
            <span style={{ fontWeight: 600 }}>Need something that is not here? </span>
            <span style={{ fontWeight: 400 }}>Ask for a copy of everything the company holds about you — the request and its deadline live on your data &amp; privacy page.</span>
          </PfBanner>
        </div>
      )}

      {/* ============================ PAY & BENEFITS ========================= */}
      {tab === "pay" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfBanner tone="blue" icon="wallet">
            <span style={{ fontWeight: 600 }}>Payroll runs in SeamlessHR, not here. </span>
            <span style={{ fontWeight: 400 }}>
              Hirebrew holds the index — which periods exist and when they were issued. No amount of yours is stored on this
              page, which is why you will not find one on it.
            </span>
          </PfBanner>

          {/* Who sees your pay — the row that earns the trust */}
          {PAY_VIS && (
            <PfCard>
              <PfCardHead title="Who sees your pay" sub={`From the transparency matrix — “${PAY_VIS.item}”.`}>
                <PfBtn small variant="secondary" icon="shield" onClick={() => go("myprivacy")}>See all 12 rows</PfBtn>
              </PfCardHead>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, padding: "16px 20px" }}>
                {[
                  { who: "You", verdict: "sees" as const, note: "Your slips, every period." },
                  { who: "HR", verdict: "sees" as const, note: "Payroll and statutory filings." },
                  { who: "Your manager", verdict: "no" as const, note: "Never your slip." },
                ].map((r) => {
                  const yes = r.verdict === "sees";
                  return (
                    <div
                      key={r.who}
                      style={{
                        border: `1px solid ${yes ? "var(--pf-n50)" : "var(--pf-primary-100)"}`,
                        background: yes ? "var(--pf-n25)" : "var(--pf-primary-50)",
                        borderRadius: 10, padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: "50%", flex: "none",
                          background: yes ? "var(--pf-n100)" : "var(--pf-primary-500)",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Ic name={yes ? "check" : "x"} size={12} color={yes ? "var(--pf-n600)" : "#fff"} weight={2.4} />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.who}</span>
                        <span style={{ flex: 1 }} />
                        <PfBadge tone={yes ? "grey" : "green"}>{yes ? "Sees" : "Does not see"}</PfBadge>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 7, lineHeight: 1.5 }}>{r.note}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "0 20px 16px", fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                {PAY_VIS.why}
              </div>
              {PAYROLL_CLAUSE && (
                <div style={{ ...footNote, alignItems: "flex-start", lineHeight: 1.55 }}>
                  <Ic name="shield" size={13} color="var(--pf-n300)" />
                  <span>
                    {PAYROLL_CLAUSE.purpose} are held for one purpose — {PAYROLL_CLAUSE.nowFor}. Lawful basis:{" "}
                    <strong style={{ color: "var(--pf-n600)", fontWeight: 600 }}>{PAYROLL_CLAUSE.lawfulBasis}</strong>, recorded on your
                    consent record at {MY_CONSENT.at}.
                  </span>
                </div>
              )}
            </PfCard>
          )}

          {/* Payslip index — no amounts */}
          <PfCard>
            <PfCardHead title="Your payslips" sub={`${MY_PAYSLIPS.length} periods · index only. The documents themselves open in SeamlessHR.`}>
              <PfBadge tone="grey">No amounts held here</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 140px auto", gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Period</PfTh>
              <PfTh>State</PfTh>
              <PfTh>Issued</PfTh>
              <PfTh style={{ textAlign: "right" }}>Document</PfTh>
            </div>
            {MY_PAYSLIPS.map((p, i) => (
              <PayslipRow
                key={p.period}
                p={p}
                last={i === MY_PAYSLIPS.length - 1}
                onOpen={() => outbound(`your ${p.period} payslip`)}
              />
            ))}
            <div style={footNote}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Salaries are paid on the 25th; PAYE and pension are deducted at source. If a slip looks wrong, raise it with Finance through SeamlessHR.
            </div>
          </PfCard>

          {/* Handbook policies */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 4 }}>
            <PfTile icon="book" tone="grey" size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>The policies behind all of this</div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>
                Five handbook documents, in the company&rsquo;s own words. Open one to read it.
              </div>
            </div>
            <PfBadge tone="grey">{POLICIES.length} policies</PfBadge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, alignItems: "start" }}>
            {POLICIES.map((p) => (
              <PolicyCard
                key={p.id}
                p={p}
                open={openDocs.includes(p.id)}
                onToggle={() => togglePolicy(p.id)}
                onCta={
                  p.id === "hb-payroll" ? () => outbound("your payslips")
                    : p.id === "hb-leave" ? () => outbound("a leave request")
                    : p.id === "hb-expenses" ? () => outbound("an expense claim")
                    : undefined
                }
                extra={
                  p.id === "hb-leave" ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}>
                      <Ic name="info" size={13} color="var(--pf-n300)" />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                        Your balance is held in SeamlessHR alongside your slips — Hirebrew does not track your days, so it
                        cannot show you a number it would only be guessing at.
                      </span>
                    </div>
                  ) : p.id === "hb-remote" ? (
                    <div style={{ marginTop: 11 }}>
                      <PfBtn small variant="secondary" icon="chat" onClick={addRemoteToAgenda}>
                        {agendaAdded ? "Open your 1-on-1" : "Ask at your next 1-on-1"}
                      </PfBtn>
                    </div>
                  ) : p.id === "hb-devices" ? (
                    <div style={{ marginTop: 11 }}>
                      <PfBtn small variant="secondary" icon="warning" onClick={() => toast("Device report raised with the Platform team — access review starts inside 24 hours")}>
                        Report a lost device
                      </PfBtn>
                    </div>
                  ) : undefined
                }
              />
            ))}
          </div>

          <PfBanner cta="open" onCta={() => go("myprivacy")}>
            <span style={{ fontWeight: 600 }}>Your pay band is not on this page, and not on your manager&rsquo;s either. </span>
            <span style={{ fontWeight: 400 }}>Who holds what about you — pay included — is listed row by row on your data &amp; privacy page.</span>
          </PfBanner>
        </div>
      )}
    </div>
  );
}
