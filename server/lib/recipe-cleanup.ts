import type { NewRecipe, RecipeSection } from "../database/schema"
import { callLLM } from "./llm"

type ScrapedRecipe = Omit<NewRecipe, "id" | "createdAt">

const systemPrompt = `You are a recipe data cleaner. The user will provide raw scraped ingredients and instructions as sectioned data.
Return a JSON object with exactly two keys: "ingredients" and "instructions".
Each must be an array of section objects: [{ "name": string|null, "items": string[] }].
Use null for section name when there is no section grouping.

Cleanup rules:
- Split compound or multi-action instruction steps into separate, focused steps.
- Standardize ingredient format: quantity + unit + item (e.g. "2 cups all-purpose flour").
- Strip leftover HTML artifacts, ad copy, or life-story preamble from steps.
- Fix obvious typos and capitalization.
- Preserve section groupings. Do NOT merge or remove sections.
- Do NOT add, remove, or substitute any ingredients or steps — only reformat and clarify.

Reply with ONLY the JSON object, no markdown fences, no commentary.`

function isValidSections(data: unknown): data is RecipeSection[] {
  if (!Array.isArray(data)) return false
  return data.every(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      "items" in s &&
      Array.isArray(s.items),
  )
}

/**
 * Sends scraped recipe data through the local LLM for cleanup.
 * Returns cleaned data, or the original data unchanged if the LLM is unavailable.
 */
export async function cleanupRecipeData(data: ScrapedRecipe): Promise<ScrapedRecipe> {
  const hasIngredients = data.ingredients.some((s) => s.items.length > 0)
  const hasInstructions = data.instructions.some((s) => s.items.length > 0)
  if (!hasIngredients && !hasInstructions) {
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

    if (!isValidSections(parsed.ingredients) || !isValidSections(parsed.instructions)) {
      return data
    }

    return {
      ...data,
      ingredients: parsed.ingredients.map((s: RecipeSection) => ({
        name: s.name,
        items: s.items.filter((i) => typeof i === "string" && i.trim()),
      })),
      instructions: parsed.instructions.map((s: RecipeSection) => ({
        name: s.name,
        items: s.items.filter((i) => typeof i === "string" && i.trim()),
      })),
    }
  } catch {
    return data
  }
}
