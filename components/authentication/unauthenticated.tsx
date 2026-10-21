"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/ui/primitives/button";

export default function UnauthenticatedOverlay() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/95 p-4 backdrop-blur">
        <div className="dungeon-card w-full max-w-sm space-y-6 p-8 text-center">
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Deepslate Dungeons
            </h1>
            <p className="text-sm text-text-muted">
              Sign in to craft your adventure
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => clerk.openSignIn({})}
              className="w-full"
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => clerk.openSignUp({})}
              className="w-full"
            >
              Sign up
            </Button>
          </div>
        </div>
      </div>
    </Unauthenticated>
  );
}
