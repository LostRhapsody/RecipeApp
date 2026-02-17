import type { NewRecipe } from "../database/schema"
import { callLLM } from "./llm"

type ScrapedRecipe = Omit<NewRecipe, "id" | "createdAt">

const systemPrompt = `You are a recipe data cleaner. The user provides raw scraped ingredients and instructions as JSON.
Return a JSON object with exactly two keys: "ingredients" (string array) and "instructions" (string array).

Rules:
- Standardize each ingredient to: quantity + unit + item (e.g. "2 cups all-purpose flour").
- Each instruction step must describe ONE action. If a step contains multiple distinct actions, split it into separate steps.
- Do NOT merge multiple steps into one. The output MUST have >= the same number of instruction items as the input.
- Do NOT merge multiple ingredients into one. The output MUST have >= the same number of ingredient items as the input.
- Strip HTML tags, ad copy, affiliate links, and life-story preamble.
- Fix obvious typos and capitalization.
- Each step should start with a verb (e.g. "Preheat", "Mix", "Pour").
- Do NOT add, remove, or substitute any ingredients.
- Do NOT invent steps not present in the original.
- Preserve all times, temperatures, and quantities exactly as given.

Return ONLY the JSON object. No markdown fences, no commentary.`

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

    const cleanedIngredients = parsed.ingredients.filter((i: unknown) => typeof i === "string" && i.trim())
    const cleanedInstructions = parsed.instructions.filter((s: unknown) => typeof s === "string" && s.trim())

    // Reject if steps/ingredients were merged (fewer than original)
    if (cleanedInstructions.length < data.instructions.length) {
      return data
    }
    if (cleanedIngredients.length < data.ingredients.length) {
      return data
    }

    return {
      ...data,
      ingredients: cleanedIngredients,
      instructions: cleanedInstructions,
    }
  } catch {
    return data
  }
}
