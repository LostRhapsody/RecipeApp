import { desc } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes } from "../../database/schema"

export default defineEventHandler(() => {
  const db = useDB()
  return db.select().from(recipes).orderBy(desc(recipes.createdAt)).all()
})
