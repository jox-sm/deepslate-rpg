"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "@/styles/auth/auth-status.module.css";

export default function AuthStatus() {
  return (
    <div className={cn(styles.wrapper, "flex items-center gap-2 border-0")}>
      <AuthLoading>
        <div className={styles.loadingContainer}>
          <Loader2 size={18} className={cn(styles.loadingIcon, "animate-spin")} />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className={styles.unauthenticatedContainer}>
          <SignInButton>
            <button className={cn(styles.signInButton, "rounded-lg")}>
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className={cn(styles.signUpButton, "rounded-lg")}>
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className={styles.authenticatedContainer}>
          <UserButton />
        </div>
      </Authenticated>
    </div>
  );
}
