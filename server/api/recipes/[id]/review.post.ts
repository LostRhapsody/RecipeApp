import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes, normalizeSections } from "../../../database/schema"
import type { RecipeSection } from "../../../database/schema"
import { callLLM } from "../../../lib/llm"

const schema = z.object({
  mode: z.enum(["review", "cleanup", "suggestions"]).default("review"),
  provider: z.enum(["local", "cloud"]).default("local"),
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

  const { mode, provider } = await readValidatedBody(event, (b) => schema.parse(b))

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
    recipe.recipeCategory && `Category: ${recipe.recipeCategory}`,
    recipe.recipeCuisine && `Cuisine: ${recipe.recipeCuisine}`,
    recipe.prepTime && `Prep: ${recipe.prepTime}`,
    recipe.cookTime && `Cook: ${recipe.cookTime}`,
    recipe.totalTime && `Total: ${recipe.totalTime}`,
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

  const systemPrompts: Record<string, string> = {
    review: `You are a recipe reviewer. The user provides a recipe with an ingredients list and numbered instructions.
Your job: identify ONLY genuine problems you can prove exist by quoting the exact text.

BEFORE flagging any issue, you MUST:
1. Re-read the ENTIRE ingredients list (all sections) to check if the information is already there.
2. Re-read the ENTIRE instructions list to check if the information is already there.
3. Only flag the issue if you are 100% certain the information is missing or wrong.

Valid issue types (ONLY these — nothing else):
- A step says to set a temperature (e.g. "preheat the oven") but the specific temperature value is never stated anywhere in the recipe.
- A step says to cook/bake for a duration but the specific time is never stated anywhere in the recipe.
- An ingredient is listed with NO measurement at all — just a bare name like "salt" with no quantity. Note: "to taste", "pinch of", and "as needed" are acceptable and are NOT issues.
- A step references an ingredient by name that does not appear anywhere in the ingredients list.

Rules:
- List each problem as a single bullet point starting with "- ".
- For each issue, quote the exact problematic text in the bullet point so the user can verify.
- If a quantity, time, or temperature IS specified anywhere in the recipe (in ANY section), it is NOT an issue. Do NOT flag it.
- When in doubt, do NOT flag it. False positives are worse than missed issues.
- Do NOT suggest flavor changes, technique alternatives, or personal preferences.
- Do NOT comment on recipe quality, taste, or style.
- If the recipe is clear and complete, reply with exactly: "No issues found."
- Maximum 5 bullet points.
- No preamble, no summary sentence, no closing remarks.`,

    cleanup: `You are a recipe reformatter. The user provides a recipe.
Rewrite ONLY the ingredients and instructions to be cleaner and better formatted.

Rules:
- Keep every single ingredient. Do NOT remove, add, or substitute any ingredient.
- Keep every single instruction step. Do NOT remove or merge steps.
- You MAY split one step into two if it contains multiple distinct actions.
- Standardize ingredient format: quantity + unit + item (e.g. "2 cups all-purpose flour").
- Each instruction step must start with a verb (e.g. "Preheat", "Mix", "Pour").
- Each instruction step must describe ONE concise action.
- Fix obvious typos and capitalization.
- Preserve all times, temperatures, and quantities exactly as given.
- Do NOT add commentary, tips, or notes.

Output format (use exactly this structure):
INGREDIENTS:
- item 1
- item 2

INSTRUCTIONS:
1. Step one
2. Step two`,

    suggestions: `You are a cooking advisor. The user provides a recipe.
Suggest exactly 3 practical improvements.

Rules:
- Number your suggestions 1, 2, 3.
- Each suggestion must be exactly one sentence.
- Each suggestion must be specific and actionable (e.g. "Toast the cumin seeds in a dry pan for 30 seconds before grinding to deepen the flavor.").
- Focus on: flavor enhancement, texture improvement, or time-saving technique.
- Do NOT repeat information already present in the recipe.
- Do NOT suggest removing any ingredient or step.
- Do NOT suggest substituting core ingredients.
- No preamble, no closing remarks.`,
  }

  const systemPrompt = systemPrompts[mode]

  const result = await callLLM(systemPrompt, recipeText, { provider })

  return { result }
})
