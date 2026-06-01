"use client";

import { Unauthenticated } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import style from "@/styles/auth/signup.module.css";

export default function Signup() {
  const clerk = useClerk();

  return (
    <Unauthenticated>
      <button
        type="button"
        onClick={() => clerk.openSignUp({})}
        className={style.button}
      >
        Sign Up
      </button>
    </Unauthenticated>
  );
}
