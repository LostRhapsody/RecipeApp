import { z } from "zod"
import { eq } from "drizzle-orm"
import { useDB } from "../../database"
import { recipes } from "../../database/schema"
import { scrapeRecipe } from "../../lib/scraper"

const schema = z.object({
  url: z.string().url("Please enter a valid URL"),
})

export default defineEventHandler(async (event) => {
  const { url } = await readValidatedBody(event, (b) => schema.parse(b))

  const db = useDB()

  // Check for existing recipe with this URL
  const existing = db.select().from(recipes).where(eq(recipes.url, url)).get()
  if (existing) {
    return { ...existing, isNew: false }
  }

  const raw = await scrapeRecipe(url)
  const inserted = db.insert(recipes).values(raw).returning().get()

  return { ...inserted, isNew: true }
})
