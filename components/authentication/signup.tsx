"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/ui/primitives/button";

export default function Signup() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => clerk.openSignUp({})}
      >
        Sign up
      </Button>
    </Unauthenticated>
  );
}
