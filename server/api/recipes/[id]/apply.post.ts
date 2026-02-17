import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes, normalizeSections } from "../../../database/schema"
import { callLLM } from "../../../lib/llm"

const schema = z.object({
  aiResponse: z.string().min(1),
  mode: z.enum(["review", "cleanup", "suggestions"]),
})

const allowedFields = new Set([
  "title",
  "description",
  "ingredients",
  "instructions",
  "prepTime",
  "cookTime",
  "totalTime",
  "freezeTime",
  "recipeYield",
  "recipeCategory",
  "recipeCuisine",
  "nutrition",
  "notes",
])

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const { aiResponse, mode } = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get()

  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  const recipeJson = JSON.stringify({
    title: recipe.title,
    description: recipe.description,
    ingredients: normalizeSections(recipe.ingredients),
    instructions: normalizeSections(recipe.instructions),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    freezeTime: recipe.freezeTime,
    recipeYield: recipe.recipeYield,
    recipeCategory: recipe.recipeCategory,
    recipeCuisine: recipe.recipeCuisine,
    nutrition: recipe.nutrition,
    notes: recipe.notes,
  }, null, 2)

  const systemPrompt = `You are a recipe data editor. The user will provide a current recipe as JSON and an AI ${mode} response with suggested changes.

Your job: Return ONLY a JSON object containing the fields that should be changed.
- Only include fields that need updating based on the AI response.
- "ingredients" must be an array of section objects: [{ "name": string|null, "items": string[] }].
- "instructions" must be an array of section objects: [{ "name": string|null, "items": string[] }].
- Use null for section name when there is no section grouping.
- "nutrition" must be an object with string keys and string values.
- All other fields are strings.
- Do NOT include unchanged fields.
- Do NOT wrap in markdown fences.
- Return ONLY valid JSON, nothing else.`

  const userPrompt = `Current recipe:\n${recipeJson}\n\nAI ${mode} response:\n${aiResponse}`

  const result = await callLLM(systemPrompt, userPrompt, {
    noThink: true,
    temperature: 0.1,
  })

  // Strip markdown fences if present
  const cleaned = result.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim()

  let parsed: Record<string, any>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "LLM returned invalid JSON. Try running the analysis again.",
    })
  }

  // Whitelist fields
  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (allowedFields.has(key) && value !== undefined) {
      filtered[key] = value
    }
  }

  if (Object.keys(filtered).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No applicable changes found in AI response.",
    })
  }

  const updated = db.update(recipes).set(filtered).where(eq(recipes.id, id)).returning().get()
  return updated
})
