import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { cookbooks } from "../../database/schema"

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid cookbook ID" })
  }

  const body = await readValidatedBody(event, (b) => schema.parse(b))

  if (Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No fields to update" })
  }

  const db = useDB()
  const updated = db.update(cookbooks).set(body).where(eq(cookbooks.id, id)).returning().get()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Cookbook not found" })
  }

  return updated
})
