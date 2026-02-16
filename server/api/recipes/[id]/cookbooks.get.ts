import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { cookbooks, cookbookRecipes } from "../../../database/schema"

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const db = useDB()
  return db
    .select({ id: cookbooks.id, name: cookbooks.name })
    .from(cookbookRecipes)
    .innerJoin(cookbooks, eq(cookbookRecipes.cookbookId, cookbooks.id))
    .where(eq(cookbookRecipes.recipeId, id))
    .all()
})
