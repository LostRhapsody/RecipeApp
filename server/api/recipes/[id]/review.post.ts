import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes } from "../../../database/schema"
import { callLLM } from "../../../lib/llm"

const schema = z.object({
  mode: z.enum(["review", "cleanup", "suggestions"]).default("review"),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const { mode } = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get()

  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  // Format recipe as plain text for the LLM
  const ingredients = (recipe.ingredients as string[]).map((i) => `- ${i}`).join("\n")
  const instructions = (recipe.instructions as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n")

  const recipeText = [
    `Title: ${recipe.title}`,
    recipe.prepTime && `Prep: ${recipe.prepTime}`,
    recipe.cookTime && `Cook: ${recipe.cookTime}`,
    recipe.recipeYield && `Yield: ${recipe.recipeYield}`,
    "",
    "Ingredients:",
    ingredients,
    "",
    "Instructions:",
    instructions,
  ]
    .filter(Boolean)
    .join("\n")

  const systemPrompt = `You are a concise cooking assistant.
The user will give you a recipe.

Task mode: ${mode}.
- review: Briefly point out unclear steps, missing times/temperatures, or safety issues.
- cleanup: Rewrite the recipe steps so they are clearer and more structured.
- suggestions: Suggest at most 3 practical improvements to flavor or technique.

Constraints:
- Reply in under 120 words.
- No chit-chat or preamble.`

  const result = await callLLM(systemPrompt, recipeText)

  return { result }
})
