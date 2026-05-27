"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";

export default function Login() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <button
        type="button"
        onClick={() => clerk.openSignIn({})}
        className="rounded-xl border border-zinc-500/30 bg-white/10 px-8 py-3 text-base font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/20 hover:shadow-xl active:scale-95"
      >
        Sign In
      </button>
    </Unauthenticated>
  );
}
