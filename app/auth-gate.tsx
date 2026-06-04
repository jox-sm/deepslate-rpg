"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Loader2 } from "lucide-react";
import UnauthenticatedOverlay from "@/components/authentication/unauthenticated";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-base">
          <Loader2 size={40} className="animate-spin text-accent" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <UnauthenticatedOverlay />
      </Unauthenticated>

      <Authenticated>
        {children}
      </Authenticated>
    </>
  );
}
