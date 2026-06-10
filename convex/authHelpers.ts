import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * Require the caller to be authenticated.
 * Throws "Unauthenticated" if no identity is found.
 */
export async function requireAuth(ctx: { auth: { getUserIdentity: () => Promise<any> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity;
}

const STAFF_DEGREE = {
  user: 0,
  customerSupport: 1,
  moderator: 2,
  admin: 3,
  superAdmin: 4,
} as const;

/**
 * Require the caller to have a minimum staff degree.
 * Throws "Unauthenticated" if not logged in.
 * Throws "Forbidden" if degree is insufficient.
 * Superadmin (degree 4) bypasses all checks.
 */
export async function requireStaff(
  ctx: { auth: { getUserIdentity: () => Promise<any> }; runQuery: any },
  minDegree: number,
) {
  const identity = await requireAuth(ctx);
  
  // Superadmin always passes
  if (minDegree <= STAFF_DEGREE.superAdmin) {
    const degree = await ctx.runQuery(api.staff.getStaffDegree, {
      clerkUserId: identity.subject,
    });
    
    if (degree >= STAFF_DEGREE.superAdmin) return { identity, degree };
    if (degree < minDegree) throw new Error("Forbidden");
    return { identity, degree };
  }
  
  return { identity, degree: STAFF_DEGREE.user };
}

export { STAFF_DEGREE };
