"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Loader2 } from "lucide-react";
import Login from "@/components/authentication/login";
import Signup from "@/components/authentication/signup";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {children}

      <AuthLoading>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <Loader2 size={32} className="animate-spin text-white" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 backdrop-blur-xl bg-black/30">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg">
              Deepslate Dungeons
            </h1>
            <p className="mt-3 text-lg text-zinc-300/90">
              Sign in to craft your adventure
            </p>
          </div>
          <div className="flex gap-4">
            <Login />
            <Signup />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
