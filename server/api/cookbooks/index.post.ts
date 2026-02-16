import { z } from "zod"
import { useDB } from "../../database"
import { cookbooks } from "../../database/schema"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (b) => schema.parse(b))
  const db = useDB()
  return db
    .insert(cookbooks)
    .values({
      name: body.name,
      description: body.description || null,
    })
    .returning()
    .get()
})
