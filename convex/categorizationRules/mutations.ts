import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    pattern: v.string(),
    categoryId: v.id("categories"),
    priority: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate regex pattern
    try {
      new RegExp(args.pattern, "i");
    } catch {
      throw new Error("Invalid regex pattern");
    }

    const id = await ctx.db.insert("categorizationRules", {
      pattern: args.pattern,
      categoryId: args.categoryId,
      priority: args.priority,
      isActive: true,
      createdBy: "user",
      matchCount: 0,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("categorizationRules"),
    pattern: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Validate regex pattern if provided
    if (updates.pattern) {
      try {
        new RegExp(updates.pattern, "i");
      } catch {
        throw new Error("Invalid regex pattern");
      }
    }

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("categorizationRules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) {
      throw new Error("Rule not found");
    }

    // Prevent deleting system rules
    if (rule.createdBy === "system") {
      throw new Error("Cannot delete system rules. Deactivate them instead.");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const toggleActive = mutation({
  args: { id: v.id("categorizationRules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) {
      throw new Error("Rule not found");
    }

    await ctx.db.patch(args.id, { isActive: !rule.isActive });
    return { id: args.id, isActive: !rule.isActive };
  },
});

export const bulkToggleActive = mutation({
  args: {
    ids: v.array(v.id("categorizationRules")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, { isActive: args.isActive });
    }
    return args.ids.length;
  },
});
