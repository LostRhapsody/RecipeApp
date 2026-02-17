import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../../database"
import { recipes, normalizeSections } from "../../../database/schema"
import { callLLM } from "../../../lib/llm"

// Preview mode: run LLM and return diff without writing to DB
const previewSchema = z.object({
  aiResponse: z.string().min(1),
  mode: z.enum(["review", "cleanup", "suggestions"]),
  provider: z.enum(["local", "cloud"]).default("local"),
  confirm: z.literal(false).optional(),
})

// Confirm mode: write a previously validated patch to DB
const confirmSchema = z.object({
  patch: z.record(z.string(), z.unknown()),
  confirm: z.literal(true),
})

const schema = z.union([previewSchema, confirmSchema])

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

  const body = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get()

  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" })
  }

  // Confirm path: write a previously validated patch directly to DB
  if ("confirm" in body && body.confirm === true) {
    const { patch } = body
    const confirmFiltered: Record<string, any> = {}
    for (const [key, value] of Object.entries(patch)) {
      if (allowedFields.has(key) && value !== undefined) {
        confirmFiltered[key] = value
      }
    }
    if (Object.keys(confirmFiltered).length === 0) {
      throw createError({ statusCode: 400, statusMessage: "No changes to apply." })
    }
    const updated = db.update(recipes).set(confirmFiltered).where(eq(recipes.id, id)).returning().get()
    return updated
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

  // Preview path: run LLM, validate, return diff without writing
  const { aiResponse, mode, provider } = body as z.infer<typeof previewSchema>

  const sharedRules = `- Return ONLY a JSON object with the fields that should change.
- "ingredients" must be an array of strings.
- "instructions" must be an array of strings.
Your job: Return ONLY a JSON object containing the fields that should be changed.
- Only include fields that need updating based on the AI response.
- "ingredients" must be an array of section objects: [{ "name": string|null, "items": string[] }].
- "instructions" must be an array of section objects: [{ "name": string|null, "items": string[] }].
- Use null for section name when there is no section grouping.
- "nutrition" must be an object with string keys and string values.
- All other fields are strings.
- The "instructions" array MUST have >= the same number of items as the original. Do NOT merge or combine steps.
- The "ingredients" array MUST have >= the same number of items as the original. Do NOT remove ingredients.
- Each instruction step must describe ONE concise action. Do NOT combine multiple actions into one step.
- Preserve all original information. Do NOT summarize, condense, or remove helpful details.
- Do NOT include fields that are unchanged.
- Do NOT wrap in markdown fences.
- Return ONLY valid JSON, nothing else.`

  const applyPrompts: Record<string, string> = {
    review: `You are a recipe data editor.
The user provides a recipe as JSON and a list of identified issues.
Apply ONLY the specific fixes for the listed issues. Do NOT change anything that is not mentioned in the issues.

${sharedRules}

Additional rules for review mode:
- If an issue mentions a missing time or temperature, add it to the relevant step text.
- If an issue mentions an ambiguous quantity, make it specific only if the correct value can be inferred.
- Do NOT rewrite steps that have no issues. Only edit the specific text that addresses each issue.`,

    cleanup: `You are a recipe data editor.
The user provides a recipe as JSON and a reformatted version of its ingredients and instructions.
Replace the ingredients and instructions with the reformatted versions.

${sharedRules}

Additional rules for cleanup mode:
- Only return "ingredients" and "instructions" keys. Do NOT change other fields.
- Copy the reformatted content faithfully. Do NOT further edit, summarize, or embellish.`,

    suggestions: `You are a recipe data editor.
The user provides a recipe as JSON and 3 improvement suggestions.
Integrate each suggestion into the recipe data with minimal changes.

${sharedRules}

Additional rules for suggestions mode:
- Add new ingredients at the END of the ingredients list.
- Add new instruction steps at the logical position, or at the END if position is unclear.
- You may modify the text of existing steps to incorporate a suggestion, but do NOT remove or merge steps.
- Keep modifications minimal — change only what the suggestion requires.`,
  }

  const systemPrompt = applyPrompts[mode]

  const ingredientCount = (recipe.ingredients as string[]).length
  const instructionCount = (recipe.instructions as string[]).length

  const userPrompt = `Current recipe (${ingredientCount} ingredients, ${instructionCount} instruction steps):\n${recipeJson}\n\nAI ${mode} response:\n${aiResponse}\n\nIMPORTANT: Your output MUST have >= ${ingredientCount} ingredients and >= ${instructionCount} instruction steps. Each step must be a single concise action.`

  const result = await callLLM(systemPrompt, userPrompt, {
    noThink: true,
    temperature: 0.1,
    provider,
    jsonMode: true,
  })

  // Strip markdown fences if present
  const cleaned = result
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim()

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

  // Structural validation: prevent merged/removed steps
  if (filtered.instructions) {
    if (!Array.isArray(filtered.instructions)) {
      throw createError({
        statusCode: 422,
        statusMessage: "Rejected: instructions must be an array.",
      })
    }
    filtered.instructions = filtered.instructions.map((s: unknown) =>
      typeof s === "string" ? s.trim() : String(s).trim(),
    ).filter(Boolean)
    const originalCount = (recipe.instructions as string[]).length
    if (filtered.instructions.length < originalCount) {
      throw createError({
        statusCode: 422,
        statusMessage: `Rejected: AI reduced instructions from ${originalCount} to ${filtered.instructions.length} steps (steps were likely merged or removed). Please try again.`,
      })
    }
    const maxStepLength = 500
    const tooLong = filtered.instructions.find((s: string) => s.length > maxStepLength)
    if (tooLong) {
      throw createError({
        statusCode: 422,
        statusMessage: `Rejected: An instruction step exceeds ${maxStepLength} characters, which suggests multiple steps were merged into one. Please try again.`,
      })
    }
  }

  if (filtered.ingredients) {
    if (!Array.isArray(filtered.ingredients)) {
      throw createError({
        statusCode: 422,
        statusMessage: "Rejected: ingredients must be an array.",
      })
    }
    filtered.ingredients = filtered.ingredients.map((s: unknown) =>
      typeof s === "string" ? s.trim() : String(s).trim(),
    ).filter(Boolean)
    const originalCount = (recipe.ingredients as string[]).length
    if (filtered.ingredients.length < originalCount) {
      throw createError({
        statusCode: 422,
        statusMessage: `Rejected: AI reduced ingredients from ${originalCount} to ${filtered.ingredients.length} items (ingredients were likely removed). Please try again.`,
      })
    }
  }

  // Return preview diff (don't write to DB yet)
  const changes: Record<string, { old: unknown; new: unknown }> = {}
  for (const [key, value] of Object.entries(filtered)) {
    changes[key] = {
      old: (recipe as Record<string, unknown>)[key],
      new: value,
    }
  }

  return { preview: true, changes, patch: filtered }
})
