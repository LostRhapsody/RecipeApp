import type { NewRecipe, RecipeSection } from "../database/schema"
import { callLLM } from "./llm"

type ScrapedRecipe = Omit<NewRecipe, "id" | "createdAt">

const systemPrompt = `You are a recipe data cleaner. The user will provide raw scraped ingredients and instructions as sectioned data.
Return a JSON object with exactly two keys: "ingredients" and "instructions".
Each must be an array of section objects: [{ "name": string|null, "items": string[] }].
Use null for section name when there is no section grouping.

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
- Preserve section groupings. Do NOT merge or remove sections.
- Do NOT add, remove, or substitute any ingredients or steps — only reformat and clarify.

Return ONLY the JSON object. No markdown fences, no commentary.`

function isValidSections(data: unknown): data is RecipeSection[] {
  if (!Array.isArray(data)) return false
  return data.every(
    (s) => typeof s === "object" && s !== null && "items" in s && Array.isArray(s.items),
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

    const cleanedIngredients = parsed.ingredients.filter(
      (i: unknown) => typeof i === "string" && i.trim(),
    )
    const cleanedInstructions = parsed.instructions.filter(
      (s: unknown) => typeof s === "string" && s.trim(),
    )

    // Reject if steps/ingredients were merged (fewer than original)
    if (cleanedInstructions.length < data.instructions.length) {
      return data
    }
    if (cleanedIngredients.length < data.ingredients.length) {
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
