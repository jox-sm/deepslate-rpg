import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// Get a staff member's degree by clerkUserId
export const getStaffDegree = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    return staff?.degree ?? 0;
  },
});

// List all staff members (admin+ only - auth check done by caller)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("staff").collect();
  },
});

// Create a staff record
export const create = mutation({
  args: {
    clerkUserId: v.string(),
    degree: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { degree: args.degree });
      return existing._id;
    }
    return await ctx.db.insert("staff", {
      clerkUserId: args.clerkUserId,
      degree: args.degree,
    });
  },
});

// Update a staff record
export const update = mutation({
  args: {
    staffId: v.id("staff"),
    degree: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.staffId, { degree: args.degree });
  },
});

// Remove a staff record
export const remove = mutation({
  args: { staffId: v.id("staff") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.staffId);
  },
});
