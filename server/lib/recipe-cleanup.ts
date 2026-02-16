import type { NewRecipe } from "../database/schema"
import { callLLM } from "./llm"

type ScrapedRecipe = Omit<NewRecipe, "id" | "createdAt">

const systemPrompt = `You are a recipe data cleaner. The user will provide raw scraped ingredients and instructions.
Return a JSON object with exactly two keys: "ingredients" (string array) and "instructions" (string array).

Cleanup rules:
- Split compound or multi-action instruction steps into separate, focused steps.
- Standardize ingredient format: quantity + unit + item (e.g. "2 cups all-purpose flour").
- Strip leftover HTML artifacts, ad copy, or life-story preamble from steps.
- Fix obvious typos and capitalization.
- Do NOT add, remove, or substitute any ingredients or steps — only reformat and clarify.

Reply with ONLY the JSON object, no markdown fences, no commentary.`

/**
 * Sends scraped recipe data through the local LLM for cleanup.
 * Returns cleaned data, or the original data unchanged if the LLM is unavailable.
 */
export async function cleanupRecipeData(data: ScrapedRecipe): Promise<ScrapedRecipe> {
  if (data.ingredients.length === 0 && data.instructions.length === 0) {
    return data
  }

  const userMessage = JSON.stringify({
    ingredients: data.ingredients,
    instructions: data.instructions,
  })

  const result = await callLLM(systemPrompt, userMessage)
  if (!result) return data

  try {
    const parsed = JSON.parse(result)

    if (!Array.isArray(parsed.ingredients) || !Array.isArray(parsed.instructions)) {
      return data
    }

    return {
      ...data,
      ingredients: parsed.ingredients.filter((i: unknown) => typeof i === "string" && i.trim()),
      instructions: parsed.instructions.filter((s: unknown) => typeof s === "string" && s.trim()),
    }
  } catch {
    return data
  }
}
