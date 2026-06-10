import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    name: v.string(),
    description: v.string(),
    image: v.optional(v.string()),
    tags: v.array(v.string()),
    likesCount: v.number(),
    ownerId: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_likes_count", ["likesCount"]),

  characters: defineTable({
    gameId: v.id("games"),
    name: v.string(),
    description: v.string(),
    image: v.optional(v.string()),
    ownerId: v.string(),
  })
    .index("by_game_id", ["gameId"]),

  maps: defineTable({
    gameId: v.id("games"),
    name: v.string(),
    image: v.optional(v.string()),
    sizeOfPlace: v.optional(v.string()),
    placesAtMap: v.optional(v.string()),
    ownerId: v.string(),
  })
    .index("by_game_id", ["gameId"]),

  items: defineTable({
    gameId: v.id("games"),
    name: v.string(),
    image: v.optional(v.string()),
    ownerId: v.string(),
  })
    .index("by_game_id", ["gameId"]),

  staff: defineTable({
    clerkUserId: v.string(),
    degree: v.number(),
  })
    .index("by_clerkUserId", ["clerkUserId"]),
});
