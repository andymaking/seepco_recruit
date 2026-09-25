"use client";
import type { ReactNode } from "react";
import { AppProvider } from "@/state/app";
import { ToastProvider } from "@/state/toast";
import { LifecycleProvider } from "@/state/lifecycle";
import { AssessmentProvider } from "@/state/assessment";
import { WorkspaceProvider } from "@/state/workspace";
import { MeProvider } from "@/state/me";
import OnboardingGuide from "@/components/OnboardingGuide";
import SandboxBar from "@/components/SandboxBar";

/**
 * Provider order matters: WorkspaceProvider sits outermost of the domain
 * stores because the OS shell, the onboarding guide and the connector-backed
 * screens all read workspace entitlement (which pillars the org switched on)
 * while rendering — and because leaving the sandbox resets the lifecycle demo
 * data, so the workspace record has to outlive it.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <WorkspaceProvider>
        <LifecycleProvider>
          <AssessmentProvider>
            <MeProvider>
              <ToastProvider>
                {children}
                <SandboxBar />
                <OnboardingGuide />
              </ToastProvider>
            </MeProvider>
          </AssessmentProvider>
        </LifecycleProvider>
      </WorkspaceProvider>
    </AppProvider>
  );
}
