import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes, normalizeSections } from "../../database/schema"

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const db = useDB()
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get()

  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  return {
    ...recipe,
    ingredients: normalizeSections(recipe.ingredients),
    instructions: normalizeSections(recipe.instructions),
  }
})
