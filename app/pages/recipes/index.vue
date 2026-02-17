<script setup lang="ts">
const toast = useToast()
const { data: recipes, status, refresh } = useFetch("/api/recipes")

// Filter state
const searchQuery = ref("")
const selectedCategory = ref("all")
const selectedCuisine = ref("all")
const sortBy = ref("newest")
const ingredientSearch = ref("")

// Selection state
const selectionMode = ref(false)
const selectedIds = ref(new Set<number>())
const showCookbookModal = ref(false)
const showDeleteConfirm = ref(false)
const bulkLoading = ref(false)

// Fetch cookbooks for the modal
const { data: cookbooks, refresh: refreshCookbooks } = useFetch("/api/cookbooks", {
  immediate: false,
})

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedIds.value = new Set()
  }
}

function toggleRecipe(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function selectAll() {
  selectedIds.value = new Set(filteredRecipes.value.map((r) => r.id))
}

function deselectAll() {
  selectedIds.value = new Set()
}

async function openCookbookModal() {
  await refreshCookbooks()
  showCookbookModal.value = true
}

async function addToCookbook(cookbookId: number) {
  bulkLoading.value = true
  try {
    const ids = [...selectedIds.value]
    await $fetch(`/api/cookbooks/${cookbookId}/recipes-bulk`, {
      method: "POST",
      body: { recipeIds: ids },
    })
    toast.add({ title: `Added ${ids.length} recipe(s) to cookbook`, color: "success" })
    showCookbookModal.value = false
    selectionMode.value = false
    selectedIds.value = new Set()
  } catch {
    toast.add({ title: "Failed to add recipes to cookbook", color: "error" })
  } finally {
    bulkLoading.value = false
  }
}

async function confirmDelete() {
  bulkLoading.value = true
  try {
    const ids = [...selectedIds.value]
    await $fetch("/api/recipes/bulk-delete", {
      method: "POST",
      body: { ids },
    })
    toast.add({ title: `Deleted ${ids.length} recipe(s)`, color: "success" })
    showDeleteConfirm.value = false
    selectionMode.value = false
    selectedIds.value = new Set()
    await refresh()
  } catch {
    toast.add({ title: "Failed to delete recipes", color: "error" })
  } finally {
    bulkLoading.value = false
  }
}

// Compute unique categories/cuisines from data
const categories = computed(() => {
  if (!recipes.value) return []
  const set = new Set(recipes.value.map((r) => r.recipeCategory).filter(Boolean))
  return [...set].toSorted() as string[]
})

const cuisines = computed(() => {
  if (!recipes.value) return []
  const set = new Set(recipes.value.map((r) => r.recipeCuisine).filter(Boolean))
  return [...set].toSorted() as string[]
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
  () =>
    searchQuery.value ||
    selectedCategory.value !== "all" ||
    selectedCuisine.value !== "all" ||
    ingredientSearch.value,
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
    return parseInt(isoMatch[1] || "0") * 60 + parseInt(isoMatch[2] || "0")
  }
  const numMatch = time.match(/(\d+)/)
  return numMatch ? parseInt(numMatch[1] || "0") : Infinity
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

  // Ingredient search (works with sectioned data)
  if (ingredientSearch.value) {
    const q = ingredientSearch.value.toLowerCase()
    result = result.filter((r) => {
      const sections = r.ingredients as { name: string | null; items: string[] }[]
      return sections.some((s) => s.items.some((ing) => ing.toLowerCase().includes(q)))
    })
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

const allSelected = computed(
  () => filteredRecipes.value.length > 0 && selectedIds.value.size === filteredRecipes.value.length,
)
</script>

<template>
  <div class="pb-20">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Saved Recipes</h1>
      <div class="flex gap-2">
        <UButton
          v-if="recipes?.length"
          :label="selectionMode ? 'Cancel' : 'Select'"
          :icon="selectionMode ? 'i-lucide-x' : 'i-lucide-check-square'"
          :variant="selectionMode ? 'soft' : 'outline'"
          @click="toggleSelectionMode"
        />
        <UButton to="/" label="Add Recipe" icon="i-lucide-plus" />
      </div>
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
        <USelect v-model="sortBy" :items="sortOptions" class="w-32" />
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
        <RecipeCard
          v-for="recipe in filteredRecipes"
          :key="recipe.id"
          :recipe="recipe"
          :selectable="selectionMode"
          :selected="selectedIds.has(recipe.id)"
          @toggle="toggleRecipe"
        />
      </div>

      <div v-else class="py-12 text-center">
        <UIcon name="i-lucide-search-x" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4">No recipes match your filters.</p>
        <UButton label="Clear filters" variant="soft" class="mt-4" @click="clearFilters" />
      </div>
    </template>

    <!-- Sticky bottom action bar -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="selectionMode && selectedIds.size > 0"
        class="bg-elevated fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3 shadow-lg"
      >
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span class="text-sm font-medium">{{ selectedIds.size }} selected</span>
          <div class="flex items-center gap-2">
            <UButton
              :label="allSelected ? 'Deselect All' : 'Select All'"
              variant="ghost"
              size="sm"
              @click="allSelected ? deselectAll() : selectAll()"
            />
            <UButton
              label="Add to Cookbook"
              icon="i-lucide-book-plus"
              variant="soft"
              size="sm"
              @click="openCookbookModal"
            />
            <UButton
              label="Delete"
              icon="i-lucide-trash-2"
              variant="soft"
              color="error"
              size="sm"
              @click="showDeleteConfirm = true"
            />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add to Cookbook modal -->
    <UModal v-model:open="showCookbookModal">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold">Add to Cookbook</h3>
          </template>
          <div v-if="!cookbooks?.length" class="py-4 text-center">
            <p class="text-muted">No cookbooks yet.</p>
            <UButton to="/cookbooks" label="Create a cookbook" variant="soft" class="mt-2" />
          </div>
          <div v-else class="flex flex-col gap-2">
            <UButton
              v-for="cookbook in cookbooks"
              :key="cookbook.id"
              :label="cookbook.name"
              variant="ghost"
              block
              :loading="bulkLoading"
              @click="addToCookbook(cookbook.id)"
            />
          </div>
        </UCard>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold">Delete Recipes</h3>
          </template>
          <p>
            Are you sure you want to delete {{ selectedIds.size }} recipe(s)? This cannot be undone.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="ghost" @click="showDeleteConfirm = false" />
              <UButton label="Delete" color="error" :loading="bulkLoading" @click="confirmDelete" />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
