import * as cheerio from "cheerio"
import type { NewRecipe } from "../database/schema"

interface JsonLdNutrition {
  "@type"?: string
  [key: string]: string | undefined
}

interface JsonLdRecipe {
  "@type"?: string | string[]
  name?: string
  description?: string
  image?: string | string[] | { url: string }
  author?: string | { name: string } | Array<string | { name: string }>
  prepTime?: string
  cookTime?: string
  totalTime?: string
  recipeYield?: string | string[]
  recipeCategory?: string | string[]
  recipeCuisine?: string | string[]
  recipeIngredient?: string[]
  recipeInstructions?: string | JsonLdInstruction[] | JsonLdSection[]
  nutrition?: JsonLdNutrition
  [key: string]: unknown
}

interface JsonLdInstruction {
  "@type"?: string
  text?: string
  name?: string
  itemListElement?: JsonLdInstruction[]
}

interface JsonLdSection {
  "@type"?: string
  name?: string
  itemListElement?: JsonLdInstruction[]
  text?: string
}

export async function scrapeRecipe(url: string): Promise<Omit<NewRecipe, "id" | "createdAt">> {
  const html = await $fetch<string>(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  })

  const $ = cheerio.load(html)

  // Strategy 1: JSON-LD
  const recipe = extractJsonLd($)
  if (recipe) {
    return normalizeJsonLd(recipe, url)
  }

  // Strategy 2: HTML microdata/selectors fallback
  return extractFromHtml($, url)
}

function extractJsonLd($: cheerio.CheerioAPI): JsonLdRecipe | null {
  const scripts = $('script[type="application/ld+json"]')

  for (let i = 0; i < scripts.length; i++) {
    try {
      const text = $(scripts[i]).html()
      if (!text) continue

      const data = JSON.parse(text)
      const recipe = findRecipeInJsonLd(data)
      if (recipe) return recipe
    } catch {
      continue
    }
  }

  return null
}

function findRecipeInJsonLd(data: unknown): JsonLdRecipe | null {
  if (!data || typeof data !== "object") return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const result = findRecipeInJsonLd(item)
      if (result) return result
    }
    return null
  }

  const obj = data as Record<string, unknown>

  // Check if this object is a Recipe
  const type = obj["@type"]
  if (type) {
    const types = Array.isArray(type) ? type : [type]
    if (types.includes("Recipe")) return obj as unknown as JsonLdRecipe
  }

  // Check @graph wrapper
  if (Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"])
  }

  return null
}

function normalizeJsonLd(recipe: JsonLdRecipe, url: string): Omit<NewRecipe, "id" | "createdAt"> {
  return {
    url,
    title: recipe.name || "Untitled Recipe",
    description: recipe.description || null,
    image: normalizeImage(recipe.image),
    author: normalizeAuthor(recipe.author),
    prepTime: formatDuration(recipe.prepTime),
    cookTime: formatDuration(recipe.cookTime),
    totalTime: formatDuration(recipe.totalTime),
    freezeTime: computeAdditionalTime(recipe.prepTime, recipe.cookTime, recipe.totalTime),
    recipeYield: normalizeStringOrArray(recipe.recipeYield),
    recipeCategory: normalizeStringOrArray(recipe.recipeCategory),
    recipeCuisine: normalizeStringOrArray(recipe.recipeCuisine),
    ingredients: recipe.recipeIngredient || [],
    instructions: normalizeInstructions(recipe.recipeInstructions),
    nutrition: normalizeNutrition(recipe.nutrition),
    notes: null,
  }
}

function normalizeImage(image: JsonLdRecipe["image"]): string | null {
  if (!image) return null
  if (typeof image === "string") return image
  if (Array.isArray(image)) return image[0] || null
  if (typeof image === "object" && "url" in image) return image.url
  return null
}

function normalizeAuthor(author: JsonLdRecipe["author"]): string | null {
  if (!author) return null
  if (typeof author === "string") return author
  if (Array.isArray(author)) {
    return author.map((a) => (typeof a === "string" ? a : a.name)).join(", ")
  }
  if (typeof author === "object" && "name" in author) return author.name
  return null
}

function normalizeStringOrArray(value: string | string[] | undefined): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value.join(", ")
  return value
}

function normalizeInstructions(instructions: JsonLdRecipe["recipeInstructions"]): string[] {
  if (!instructions) return []
  if (typeof instructions === "string") {
    return instructions
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(instructions)) return []

  const result: string[] = []
  for (const item of instructions) {
    if (item["@type"] === "HowToStep" && item.text) {
      result.push(item.text.trim())
    } else if (item["@type"] === "HowToSection" && item.itemListElement) {
      if (item.name) result.push(`**${item.name}**`)
      for (const step of item.itemListElement) {
        if (step.text) result.push(step.text.trim())
      }
    }
  }
  return result
}

function normalizeNutrition(nutrition: JsonLdNutrition | undefined): Record<string, string> | null {
  if (!nutrition || typeof nutrition !== "object") return null

  const result: Record<string, string> = {}
  const fields = [
    "calories",
    "fatContent",
    "saturatedFatContent",
    "unsaturatedFatContent",
    "transFatContent",
    "carbohydrateContent",
    "sugarContent",
    "fiberContent",
    "proteinContent",
    "cholesterolContent",
    "sodiumContent",
    "servingSize",
  ]

  for (const field of fields) {
    const value = nutrition[field]
    if (value && typeof value === "string") {
      result[field] = value
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

function parseDurationMinutes(iso: string | undefined): number | null {
  if (!iso) return null
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)
  if (!match) return null
  return parseInt(match[1] || "0") * 60 + parseInt(match[2] || "0")
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  return parts.join(" ") || null!
}

function computeAdditionalTime(
  prepTime: string | undefined,
  cookTime: string | undefined,
  totalTime: string | undefined,
): string | null {
  const total = parseDurationMinutes(totalTime)
  const prep = parseDurationMinutes(prepTime) || 0
  const cook = parseDurationMinutes(cookTime) || 0
  if (!total) return null
  const additional = total - prep - cook
  if (additional <= 0) return null
  return formatMinutes(additional)
}

function formatDuration(iso: string | undefined): string | null {
  if (!iso) return null
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)
  if (!match) return iso
  const hours = match[1] ? `${match[1]}h` : ""
  const minutes = match[2] ? `${match[2]}m` : ""
  const parts = [hours, minutes].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : null
}

function extractFromHtml($: cheerio.CheerioAPI, url: string): Omit<NewRecipe, "id" | "createdAt"> {
  const title =
    $('[itemprop="name"]').first().text().trim() ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled Recipe"

  const description = $('[itemprop="description"]').first().text().trim() || null
  const image =
    $('[itemprop="image"]').first().attr("src") ||
    $('[itemprop="image"]').first().attr("content") ||
    $('meta[property="og:image"]').attr("content") ||
    null

  const author = $('[itemprop="author"]').first().text().trim() || null

  const ingredients: string[] = []
  $('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each((_, el) => {
    const text = $(el).text().trim()
    if (text) ingredients.push(text)
  })

  const instructions: string[] = []
  $('[itemprop="recipeInstructions"]').each((_, el) => {
    const tag = el.tagName?.toLowerCase()
    if (tag === "ol" || tag === "ul") {
      $(el)
        .find("li")
        .each((_, li) => {
          const text = $(li).text().trim()
          if (text) instructions.push(text)
        })
    } else {
      const text = $(el).text().trim()
      if (text) {
        text
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => instructions.push(s))
      }
    }
  })

  const prepTimeRaw = $('[itemprop="prepTime"]').first().attr("content") || undefined
  const cookTimeRaw = $('[itemprop="cookTime"]').first().attr("content") || undefined
  const freezeTimeRaw = $('[itemprop="freezeTime"]').first().attr("content") || undefined
  const totalTimeRaw = $('[itemprop="totalTime"]').first().attr("content") || undefined

  return {
    url,
    title,
    description,
    image,
    author,
    prepTime: formatDuration(prepTimeRaw),
    cookTime: formatDuration(cookTimeRaw),
    totalTime: formatDuration(totalTimeRaw),
    freezeTime: formatDuration(freezeTimeRaw),
    recipeYield: $('[itemprop="recipeYield"]').first().text().trim() || null,
    recipeCategory: $('[itemprop="recipeCategory"]').first().text().trim() || null,
    recipeCuisine: $('[itemprop="recipeCuisine"]').first().text().trim() || null,
    ingredients,
    instructions,
    nutrition: null,
    notes: null,
  }
}
