import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes } from "../../database/schema"

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const db = useDB()
  const deleted = db.delete(recipes).where(eq(recipes.id, id)).returning().get()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  return { success: true }
})
