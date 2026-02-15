# Recipe App

"Just the Recipe" clone — paste a recipe URL, scrape ingredients/instructions, store in SQLite, display in a clean UI.

## Tech Stack

- **Framework:** Nuxt 4 (Vue 3, Nitro)
- **UI:** Nuxt UI v4 (Tailwind CSS 4)
- **Database:** SQLite via better-sqlite3 + Drizzle ORM
- **Scraping:** Cheerio (HTML parsing) with JSON-LD primary strategy
- **Local LLM:** Qwen3-4B via llama.cpp (OpenAI-compatible API) for recipe review/cleanup/suggestions
- **Linting/Formatting:** oxlint + oxfmt (not ESLint/Prettier)

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # Lint with oxlint
bun run format       # Format with oxfmt
bun run db:push      # Push schema to SQLite (dev)
bun run db:generate  # Generate migration files
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```

## Project Structure

```
app/
  pages/              # File-based routing
    index.vue         # URL input form (home)
    recipes/
      index.vue       # Recipe grid list
      [id].vue        # Recipe detail view
  components/
    RecipeCard.vue    # Recipe card for grid
  layouts/
    default.vue       # Nav header + centered content
  assets/css/
    main.css          # Tailwind + Nuxt UI imports
server/
  api/recipes/        # API routes
    scrape.post.ts    # POST /api/recipes/scrape
    index.get.ts      # GET /api/recipes
    [id].get.ts       # GET /api/recipes/:id
    [id].delete.ts    # DELETE /api/recipes/:id
    [id]/
      review.post.ts  # POST /api/recipes/:id/review (LLM review)
  database/
    schema.ts         # Drizzle schema (recipes table)
    index.ts          # DB connection singleton
    migrations/       # Generated migration files
  lib/
    scraper.ts        # Recipe scraper (JSON-LD + HTML fallback)
  plugins/
    migrations.ts     # Auto-migrate on server start
```

## Key Patterns

- **Zod validation** on API inputs via `readValidatedBody`
- **DB singleton:** `useDB()` returns a cached Drizzle instance
- **Auto-imports:** Nuxt auto-imports Vue/Nuxt composables and `$fetch`, `defineEventHandler`, etc.
- **JSON columns:** `ingredients` and `instructions` stored as JSON text arrays in SQLite
- **Deduplication:** Scraping a URL that already exists returns the existing recipe
- **Local LLM:** `NUXT_LLAMA_BASE_URL` env var configures the llama.cpp server URL (default `http://127.0.0.1:8081`)

## Code Style

- oxfmt: no semicolons, double quotes, 2-space indent, 100 char width
- oxlint: correctness=error, suspicious=warn, perf=warn
