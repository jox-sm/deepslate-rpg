"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Button } from "@/ui/primitives/button";

export default function AuthStatus() {
  return (
    <div className="flex items-center gap-2">
      <AuthLoading>
        <div className="flex items-center justify-center p-1">
          <Loader2 size={18} className="animate-spin text-text-muted" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex items-center gap-2">
          <SignInButton>
            <Button size="sm">Sign in</Button>
          </SignInButton>
          <SignUpButton>
            <Button size="sm" variant="outline">Sign up</Button>
          </SignUpButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <UserButton />
      </Authenticated>
    </div>
  );
}
