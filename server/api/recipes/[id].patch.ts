import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes } from "../../database/schema"

const sectionSchema = z.object({
  name: z.string().nullable(),
  items: z.array(z.string()),
})

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  prepTime: z.string().nullable().optional(),
  cookTime: z.string().nullable().optional(),
  totalTime: z.string().nullable().optional(),
  freezeTime: z.string().nullable().optional(),
  recipeYield: z.string().nullable().optional(),
  recipeCategory: z.string().nullable().optional(),
  recipeCuisine: z.string().nullable().optional(),
  ingredients: z.array(sectionSchema).optional(),
  instructions: z.array(sectionSchema).optional(),
  nutrition: z.record(z.string(), z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const body = await readValidatedBody(event, (b) => schema.parse(b))

  if (Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No fields to update" })
  }

  const db = useDB()
  const updated = db.update(recipes).set(body).where(eq(recipes.id, id)).returning().get()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  return updated
})
