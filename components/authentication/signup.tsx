"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";

export default function Signup() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <button
        type="button"
        onClick={() => clerk.openSignUp({})}
        className="rounded-xl bg-white px-8 py-3 text-base font-semibold text-black shadow-lg transition-all hover:bg-zinc-200 hover:shadow-xl active:scale-95"
      >
        Sign Up
      </button>
    </Unauthenticated>
  );
}
