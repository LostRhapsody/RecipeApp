import { z } from "zod"
import { inArray } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes } from "../../database/schema"

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
})

export default defineEventHandler(async (event) => {
  const { ids } = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()
  const deleted = db.delete(recipes).where(inArray(recipes.id, ids)).returning().all()

  return { deleted: deleted.length }
})
