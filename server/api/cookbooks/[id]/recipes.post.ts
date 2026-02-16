import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { cookbooks, cookbookRecipes, recipes } from "../../../database/schema"

const schema = z.object({
  recipeId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid cookbook ID" })
  }

  const { recipeId } = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()

  // Verify cookbook exists
  const cookbook = db.select().from(cookbooks).where(eq(cookbooks.id, id)).get()
  if (!cookbook) {
    throw createError({ statusCode: 404, statusMessage: "Cookbook not found" })
  }

  // Verify recipe exists
  const recipe = db.select().from(recipes).where(eq(recipes.id, recipeId)).get()
  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  try {
    return db
      .insert(cookbookRecipes)
      .values({ cookbookId: id, recipeId })
      .returning()
      .get()
  } catch {
    throw createError({ statusCode: 409, statusMessage: "Recipe already in cookbook" })
  }
})
