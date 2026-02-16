import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { cookbooks } from "../../database/schema"

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid cookbook ID" })
  }

  const db = useDB()
  const deleted = db.delete(cookbooks).where(eq(cookbooks.id, id)).returning().get()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Cookbook not found" })
  }

  return { success: true }
})
