import WelcomePortal from "@/screens/WelcomePortal";

/**
 * /welcome — the new hire's own onboarding surface (PATH A).
 *
 * Deliberately a TOP-LEVEL route, a sibling of /candidate-portal and /signin,
 * so neither the recruit `Shell` nor the Talent OS `OsShell` wraps it: the hire
 * has no account and no persona until day one creates one, so the surface he is
 * sent a token link to the hour he signs cannot sit behind persona gating.
 * It is not an OS stage — nothing is registered in osnav.ts or personas.ts.
 */
export default function Page() {
  return <WelcomePortal />;
}
