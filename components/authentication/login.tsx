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
        className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-200 ease-ember hover:bg-accent-hover active:scale-[0.97]"
      >
        Sign In
      </button>
    </Unauthenticated>
  );
}
