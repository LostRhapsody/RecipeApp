import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export interface RecipeSection {
  name: string | null
  items: string[]
}

/**
 * Normalizes raw JSON from the database (which may be a flat string[]
 * from old data or a RecipeSection[] from new data) into RecipeSection[].
 */
export function normalizeSections(data: unknown): RecipeSection[] {
  if (!Array.isArray(data) || data.length === 0) return [{ name: null, items: [] }]
  if (typeof data[0] === "string") return [{ name: null, items: data as string[] }]
  return data as RecipeSection[]
}

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  image: text("image"),
  author: text("author"),
  prepTime: text("prep_time"),
  cookTime: text("cook_time"),
  totalTime: text("total_time"),
  recipeYield: text("recipe_yield"),
  recipeCategory: text("recipe_category"),
  recipeCuisine: text("recipe_cuisine"),
  freezeTime: text("freeze_time"),
  ingredients: text("ingredients", { mode: "json" }).notNull().$type<RecipeSection[]>(),
  instructions: text("instructions", { mode: "json" }).notNull().$type<RecipeSection[]>(),
  nutrition: text("nutrition", { mode: "json" }).$type<Record<string, string>>(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert

export const cookbooks = sqliteTable("cookbooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type Cookbook = typeof cookbooks.$inferSelect
export type NewCookbook = typeof cookbooks.$inferInsert

export const cookbookRecipes = sqliteTable("cookbook_recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cookbookId: integer("cookbook_id")
    .notNull()
    .references(() => cookbooks.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
})
