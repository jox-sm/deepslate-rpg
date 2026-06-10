import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { api } from "./_generated/api";

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const get = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.gameId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    image: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const gameId = await ctx.db.insert("games", {
      name: args.name,
      description: args.description,
      image: args.image,
      tags: args.tags,
      likesCount: 0,
      ownerId: identity.tokenIdentifier,
    });
    return gameId;
  },
});

export const update = mutation({
  args: {
    gameId: v.id("games"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.ownerId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");

    const { gameId, ...fields } = args;
    await ctx.db.patch(gameId, fields);
  },
});

export const remove = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.ownerId !== identity.tokenIdentifier)
      throw new Error("Unauthorized");

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const character of characters) {
      await ctx.db.delete(character._id);
    }

    const maps = await ctx.db
      .query("maps")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const map of maps) {
      await ctx.db.delete(map._id);
    }

    const items = await ctx.db
      .query("items")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.gameId);
  },
});
