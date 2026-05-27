"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Authenticated>
        <UserProfile />
      </Authenticated>
      <Unauthenticated>
        <div className="text-center text-zinc-400">
          <p className="text-lg">You need to sign in to view your profile.</p>
        </div>
      </Unauthenticated>
    </div>
  );
}
