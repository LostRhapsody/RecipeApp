import { eq, count } from "drizzle-orm"
import { useDB } from "../../database"
import { cookbooks, cookbookRecipes } from "../../database/schema"

export default defineEventHandler(() => {
  const db = useDB()
  const results = db
    .select({
      id: cookbooks.id,
      name: cookbooks.name,
      description: cookbooks.description,
      createdAt: cookbooks.createdAt,
      recipeCount: count(cookbookRecipes.id),
    })
    .from(cookbooks)
    .leftJoin(cookbookRecipes, eq(cookbooks.id, cookbookRecipes.cookbookId))
    .groupBy(cookbooks.id)
    .orderBy(cookbooks.createdAt)
    .all()

  return results
})
