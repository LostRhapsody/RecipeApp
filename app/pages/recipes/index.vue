<script setup lang="ts">
const { data: recipes, status } = useFetch("/api/recipes")

// Filter state
const searchQuery = ref("")
const selectedCategory = ref("all")
const selectedCuisine = ref("all")
const sortBy = ref("newest")
const ingredientSearch = ref("")

// Compute unique categories/cuisines from data
const categories = computed(() => {
  if (!recipes.value) return []
  const set = new Set(recipes.value.map((r) => r.recipeCategory).filter(Boolean))
  return [...set].sort() as string[]
})

const cuisines = computed(() => {
  if (!recipes.value) return []
  const set = new Set(recipes.value.map((r) => r.recipeCuisine).filter(Boolean))
  return [...set].sort() as string[]
})

const categoryOptions = computed(() => [
  { label: "All Categories", value: "all" },
  ...categories.value.map((c) => ({ label: c, value: c })),
])

const cuisineOptions = computed(() => [
  { label: "All Cuisines", value: "all" },
  ...cuisines.value.map((c) => ({ label: c, value: c })),
])

const sortOptions = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Cook Time", value: "cookTime" },
]

const hasActiveFilters = computed(
  () => searchQuery.value || selectedCategory.value !== "all" || selectedCuisine.value !== "all" || ingredientSearch.value,
)

function clearFilters() {
  searchQuery.value = ""
  selectedCategory.value = "all"
  selectedCuisine.value = "all"
  ingredientSearch.value = ""
  sortBy.value = "newest"
}

function parseTime(time: string | null): number {
  if (!time) return Infinity
  // Try to extract minutes from common formats like "PT30M", "30 min", "1 hr 30 min", etc.
  const isoMatch = time.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (isoMatch) {
    return (parseInt(isoMatch[1] || "0") * 60) + parseInt(isoMatch[2] || "0")
  }
  const numMatch = time.match(/(\d+)/)
  return numMatch ? parseInt(numMatch[1]) : Infinity
}

const filteredRecipes = computed(() => {
  if (!recipes.value) return []

  let result = [...recipes.value]

  // Name search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((r) => r.title.toLowerCase().includes(q))
  }

  // Category filter
  if (selectedCategory.value !== "all") {
    result = result.filter((r) => r.recipeCategory === selectedCategory.value)
  }

  // Cuisine filter
  if (selectedCuisine.value !== "all") {
    result = result.filter((r) => r.recipeCuisine === selectedCuisine.value)
  }

  // Ingredient search
  if (ingredientSearch.value) {
    const q = ingredientSearch.value.toLowerCase()
    result = result.filter((r) =>
      (r.ingredients as string[]).some((ing) => ing.toLowerCase().includes(q)),
    )
  }

  // Sort
  if (sortBy.value === "oldest") {
    result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } else if (sortBy.value === "cookTime") {
    result.sort((a, b) => parseTime(a.cookTime) - parseTime(b.cookTime))
  } else {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  return result
})
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Saved Recipes</h1>
      <UButton to="/" label="Add Recipe" icon="i-lucide-plus" />
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="text-muted size-8 animate-spin" />
    </div>

    <template v-else-if="!recipes?.length">
      <div class="py-12 text-center">
        <UIcon name="i-lucide-book-open" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4">No recipes saved yet.</p>
        <UButton to="/" label="Add your first recipe" variant="soft" class="mt-4" />
      </div>
    </template>

    <template v-else>
      <!-- Filters -->
      <div class="mb-6 flex flex-wrap items-end gap-3">
        <UInput
          v-model="searchQuery"
          placeholder="Search recipes..."
          icon="i-lucide-search"
          class="w-48"
        />
        <UInput
          v-model="ingredientSearch"
          placeholder="Search ingredients..."
          icon="i-lucide-list"
          class="w-48"
        />
        <USelect
          v-if="categories.length"
          v-model="selectedCategory"
          :items="categoryOptions"
          class="w-40"
        />
        <USelect
          v-if="cuisines.length"
          v-model="selectedCuisine"
          :items="cuisineOptions"
          class="w-40"
        />
        <USelect
          v-model="sortBy"
          :items="sortOptions"
          class="w-32"
        />
        <UButton
          v-if="hasActiveFilters"
          label="Clear"
          variant="ghost"
          icon="i-lucide-x"
          size="sm"
          @click="clearFilters"
        />
      </div>

      <!-- Results -->
      <div v-if="filteredRecipes.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RecipeCard v-for="recipe in filteredRecipes" :key="recipe.id" :recipe="recipe" />
      </div>

      <div v-else class="py-12 text-center">
        <UIcon name="i-lucide-search-x" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4">No recipes match your filters.</p>
        <UButton label="Clear filters" variant="soft" class="mt-4" @click="clearFilters" />
      </div>
    </template>
  </div>
</template>
