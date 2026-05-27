"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Loader2 } from "lucide-react";
import UnauthenticatedOverlay from "@/components/authentication/unauthenticated";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f0f0f]">
          <Loader2 size={40} className="animate-spin text-white" />
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
