"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import style from "@/styles/auth/auth-status.module.css";

export default function AuthStatus() {
  return (
    <div className={style.wrapper}>
      <AuthLoading>
        <div className={style.loadingContainer}>
          <Loader2 size={18} className={style.loadingIcon} />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className={style.unauthenticatedContainer}>
          <SignInButton>
            <button className={style.signInButton}>
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className={style.signUpButton}>
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className={style.authenticatedContainer}>
          <UserButton />
        </div>
      </Authenticated>
    </div>
  );
}
