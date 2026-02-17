import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes, normalizeSections } from "../../../database/schema"
import type { RecipeSection } from "../../../database/schema"
import { callLLM } from "../../../lib/llm"

const schema = z.object({
  mode: z.enum(["review", "cleanup", "suggestions"]).default("review"),
})

function formatSectionsAsText(sections: RecipeSection[], numbered: boolean): string {
  return sections
    .map((section) => {
      const header = section.name ? `\n${section.name}:\n` : ""
      const items = numbered
        ? section.items.map((s, i) => `${i + 1}. ${s}`).join("\n")
        : section.items.map((s) => `- ${s}`).join("\n")
      return header + items
    })
    .join("\n")
}

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
  const ingredientSections = normalizeSections(recipe.ingredients)
  const instructionSections = normalizeSections(recipe.instructions)

  const recipeText = [
    `Title: ${recipe.title}`,
    recipe.prepTime && `Prep: ${recipe.prepTime}`,
    recipe.cookTime && `Cook: ${recipe.cookTime}`,
    recipe.recipeYield && `Yield: ${recipe.recipeYield}`,
    "",
    "Ingredients:",
    formatSectionsAsText(ingredientSections, false),
    "",
    "Instructions:",
    formatSectionsAsText(instructionSections, true),
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
