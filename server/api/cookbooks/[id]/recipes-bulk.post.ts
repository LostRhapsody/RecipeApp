import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { cookbooks, cookbookRecipes } from "../../../database/schema"

const schema = z.object({
  recipeIds: z.array(z.number().int().positive()).min(1),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid cookbook ID" })
  }

  const { recipeIds } = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()

  // Verify cookbook exists
  const cookbook = db.select().from(cookbooks).where(eq(cookbooks.id, id)).get()
  if (!cookbook) {
    throw createError({ statusCode: 404, statusMessage: "Cookbook not found" })
  }

  const values = recipeIds.map((recipeId) => ({ cookbookId: id, recipeId }))
  const inserted = db.insert(cookbookRecipes).values(values).onConflictDoNothing().returning().all()

  return { added: inserted.length }
})
