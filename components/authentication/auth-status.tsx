"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function AuthStatus() {
  return (
    <div className="border-t border-zinc-800">
      <AuthLoading>
        <div className="flex items-center justify-center p-4">
          <Loader2 size={18} className="animate-spin text-zinc-400" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex flex-col gap-2 p-4">
          <SignInButton>
            <button className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="flex items-center justify-center p-4">
          <UserButton afterSignOutUrl="/" />
        </div>
      </Authenticated>
    </div>
  );
}
