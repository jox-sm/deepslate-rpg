import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("characters")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(50);
  },
});

export const create = mutation({
  args: {
    gameId: v.id("games"),
    name: v.string(),
    description: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("characters", {
      gameId: args.gameId,
      name: args.name,
      description: args.description,
      image: args.image,
    });
  },
});

export const update = mutation({
  args: {
    characterId: v.id("characters"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { characterId, ...fields } = args;
    await ctx.db.patch(characterId, fields);
  },
});

export const remove = mutation({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.characterId);
  },
});
