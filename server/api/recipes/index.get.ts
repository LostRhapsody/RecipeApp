import { desc } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes, normalizeSections } from "../../database/schema"

export default defineEventHandler(() => {
  const db = useDB()
  const all = db.select().from(recipes).orderBy(desc(recipes.createdAt)).all()
  return all.map((r) => {
    r.ingredients = normalizeSections(r.ingredients)
    r.instructions = normalizeSections(r.instructions)
    return r
  })
})
