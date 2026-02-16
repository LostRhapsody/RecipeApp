import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { cookbookRecipes } from "../../../database/schema"

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
  const deleted = db
    .delete(cookbookRecipes)
    .where(and(eq(cookbookRecipes.cookbookId, id), eq(cookbookRecipes.recipeId, recipeId)))
    .returning()
    .get()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not in cookbook" })
  }

  return { success: true }
})
