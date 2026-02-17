import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes } from "../../../database/schema"
import { callLLM } from "../../../lib/llm"

const schema = z.object({
  mode: z.enum(["review", "cleanup", "suggestions"]).default("review"),
  provider: z.enum(["local", "cloud"]).default("local"),
})

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
  const ingredients = (recipe.ingredients as string[]).map((i) => `- ${i}`).join("\n")
  const instructions = (recipe.instructions as string[]).map((s, i) => `${i + 1}. ${s}`).join("\n")

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
    ingredients,
    "",
    "Instructions:",
    instructions,
  ]
    .filter(Boolean)
    .join("\n")

  const systemPrompts: Record<string, string> = {
    review: `You are a recipe reviewer. The user provides a recipe.
Examine the recipe and identify ONLY problems you can confirm from the text provided.

Rules:
- List each problem as a single bullet point starting with "- ".
- Only flag issues that are clearly visible in the provided text. Do NOT guess, assume, or infer issues.
- Valid issue types:
  * A step mentions a temperature but does not specify the value.
  * A step mentions a cook/bake time but does not specify the duration.
  * An ingredient uses an ambiguous quantity like "some", "a bit", or no quantity at all.
  * A step references an ingredient that is not in the ingredients list.
  * A step has unclear doneness indicator (e.g. "cook until done" with no visual/tactile cue).
- Do NOT flag steps that are already clear and complete.
- Do NOT suggest flavor changes, technique alternatives, or personal preferences.
- Do NOT invent issues. If the recipe is clear and complete, reply with exactly: "No issues found."
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
