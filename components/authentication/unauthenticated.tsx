"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import styles from "@/styles/authentication/unauthenticated.module.css";

export default function UnauthenticatedOverlay() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <div className={styles.overlay}>
        <div className="absolute inset-0 bg-gradient-radial-accent pointer-events-none" />
        <div className={cn(styles.content, "max-w-sm")}>
          <div className="space-y-3">
            <h1 className={cn(styles.logo, "text-5xl md:text-[3.75rem] lg:text-[4.5rem]")}>
              Deepslate Dungeons
            </h1>
            <p className={styles.description}>
              Sign in to craft your adventure
            </p>
          </div>
          <div className={cn(styles.buttons, "flex-col")}>
            <button
              type="button"
              onClick={() => clerk.openSignIn({})}
              className={cn(styles.button, styles.buttonSignIn, "w-full")}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => clerk.openSignUp({})}
              className={cn(styles.button, styles.buttonSignUp, "w-full")}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </Unauthenticated>
  );
}
