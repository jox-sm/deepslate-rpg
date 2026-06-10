import { Doc, Id } from "../../convex/_generated/dataModel";

export type StaffRecord = Doc<"staff">;

export interface StaffAssignment {
  clerkUserId: string;
  degree: number;
}

export interface AuthorizationResult {
  authenticated: boolean;
  degree: number;
  clerkUserId: string | null;
}
