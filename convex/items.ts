import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("items")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(50);
  },
});

export const create = mutation({
  args: {
    gameId: v.id("games"),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.db.insert("items", {
      gameId: args.gameId,
      name: args.name,
      image: args.image,
      ownerId: identity.tokenIdentifier,
    });
  },
});

export const update = mutation({
  args: {
    itemId: v.id("items"),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { itemId, ...fields } = args;
    const doc = await ctx.db.get(itemId);
    if (!doc || doc.ownerId !== identity.tokenIdentifier) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(itemId, fields);
  },
});

export const remove = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const doc = await ctx.db.get(args.itemId);
    if (!doc || doc.ownerId !== identity.tokenIdentifier) {
      throw new Error("Forbidden");
    }
    await ctx.db.delete(args.itemId);
  },
});
