import type { ReactNode } from "react";
import OsShell from "@/components/os/OsShell";
export default function OsLayout({ children }: { children: ReactNode }) {
  return <OsShell>{children}</OsShell>;
}
