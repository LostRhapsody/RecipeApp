import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes } from "../../../database/schema"

const schema = z.object({
  mode: z.enum(["review", "cleanup", "suggestions"]).default("review"),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid recipe ID" })
  }

  const { mode } = await readValidatedBody(event, schema.parse)

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

  const { llamaBaseUrl } = useRuntimeConfig()

  const res = await $fetch<{
    choices: { message: { content: string } }[]
  }>(`${llamaBaseUrl}/v1/chat/completions`, {
    method: "POST",
    body: {
      model: "qwen3-4b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: recipeText },
      ],
      max_tokens: 1024,
      temperature: 0.4,
      top_p: 0.9,
    },
  }).catch(() => {
    throw createError({
      statusCode: 503,
      statusMessage: "Local LLM server is not running. Start llama-server first.",
    })
  })

  const content = res.choices?.[0]?.message?.content ?? ""

  // Strip <think>...</think> blocks from reasoning models
  const result = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()

  return { result }
})
