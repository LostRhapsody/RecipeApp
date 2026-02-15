import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

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
  ingredients: text("ingredients", { mode: "json" }).notNull().$type<string[]>(),
  instructions: text("instructions", { mode: "json" }).notNull().$type<string[]>(),
  nutrition: text("nutrition", { mode: "json" }).$type<Record<string, string>>(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert
