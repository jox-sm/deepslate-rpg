import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("maps")
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
    sizeOfPlace: v.optional(v.string()),
    placesAtMap: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.db.insert("maps", {
      gameId: args.gameId,
      name: args.name,
      image: args.image,
      sizeOfPlace: args.sizeOfPlace,
      placesAtMap: args.placesAtMap,
      ownerId: identity.tokenIdentifier,
    });
  },
});

export const update = mutation({
  args: {
    mapId: v.id("maps"),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    sizeOfPlace: v.optional(v.string()),
    placesAtMap: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { mapId, ...fields } = args;
    const doc = await ctx.db.get(mapId);
    if (!doc || doc.ownerId !== identity.tokenIdentifier) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(mapId, fields);
  },
});

export const remove = mutation({
  args: { mapId: v.id("maps") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const doc = await ctx.db.get(args.mapId);
    if (!doc || doc.ownerId !== identity.tokenIdentifier) {
      throw new Error("Forbidden");
    }
    await ctx.db.delete(args.mapId);
  },
});
