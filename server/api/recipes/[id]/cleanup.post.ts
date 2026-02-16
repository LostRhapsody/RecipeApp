import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes } from "../../../database/schema"
import { cleanupRecipeData } from "../../../lib/recipe-cleanup"

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const db = useDB()
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get()

  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  const cleaned = await cleanupRecipeData({
    title: recipe.title,
    url: recipe.url,
    image: recipe.image,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    recipeYield: recipe.recipeYield,
    ingredients: recipe.ingredients as string[],
    instructions: recipe.instructions as string[],
  })

  const updated = db
    .update(recipes)
    .set({
      ingredients: cleaned.ingredients,
      instructions: cleaned.instructions,
    })
    .where(eq(recipes.id, id))
    .returning()
    .get()

  return updated
})
