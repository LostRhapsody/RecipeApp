import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { cookbooks, cookbookRecipes, recipes } from "../../database/schema"

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid cookbook ID" })
  }

  const db = useDB()
  const cookbook = db.select().from(cookbooks).where(eq(cookbooks.id, id)).get()

  if (!cookbook) {
    throw createError({ statusCode: 404, statusMessage: "Cookbook not found" })
  }

  const cbRecipes = db
    .select({ recipe: recipes })
    .from(cookbookRecipes)
    .innerJoin(recipes, eq(cookbookRecipes.recipeId, recipes.id))
    .where(eq(cookbookRecipes.cookbookId, id))
    .all()
    .map((r) => r.recipe)

  return { ...cookbook, recipes: cbRecipes }
})
