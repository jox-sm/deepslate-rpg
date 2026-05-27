"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import style from "@/styles/authentication/unauthenticated.module.css";

export default function UnauthenticatedOverlay() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <div className={style.unauthenticatedOverlay}>
        <div className={style.unauthenticatedContent}>
          <h1 className={style.unauthenticatedLogo}>
            Deepslate Dungeons
          </h1>
          <p className={style.unauthenticatedDescription}>
            Sign in to craft your adventure
          </p>
          <div className={style.unauthenticatedButtons}>
            <button
              type="button"
              onClick={() => clerk.openSignIn({})}
              className={`${style.unauthenticatedButton} ${style.unauthenticatedButtonSignIn}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => clerk.openSignUp({})}
              className={`${style.unauthenticatedButton} ${style.unauthenticatedButtonSignUp}`}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </Unauthenticated>
  );
}
