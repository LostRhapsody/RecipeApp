<script setup lang="ts">
const route = useRoute()
const toast = useToast()

const { data: recipe, status, refresh } = useFetch(`/api/recipes/${route.params.id}`)

// Cookbooks
const { data: allCookbooks, refresh: refreshCookbooks } = useFetch("/api/cookbooks")
const { data: recipeCookbooks, refresh: refreshRecipeCookbooks } = useFetch(
  `/api/recipes/${route.params.id}/cookbooks`,
)

const recipeCookbookIds = computed(() => new Set((recipeCookbooks.value || []).map((c) => c.id)))

async function addToCookbook(cookbookId: number) {
  try {
    await $fetch(`/api/cookbooks/${cookbookId}/recipes`, {
      method: "POST",
      body: { recipeId: Number(route.params.id) },
    })
    await refreshRecipeCookbooks()
    toast.add({ title: "Added to cookbook", color: "success" })
  } catch (e: any) {
    toast.add({
      title: "Failed to add to cookbook",
      description: e.data?.message || "",
      color: "error",
    })
  }
}

async function removeFromCookbook(cookbookId: number) {
  try {
    await $fetch(`/api/cookbooks/${cookbookId}/recipes`, {
      method: "DELETE",
      body: { recipeId: Number(route.params.id) },
    })
    await refreshRecipeCookbooks()
    toast.add({ title: "Removed from cookbook", color: "success" })
  } catch {
    toast.add({ title: "Failed to remove from cookbook", color: "error" })
  }
}

// Edit mode
const editing = ref(false)
const editData = ref<Record<string, any>>({})
const saving = ref(false)

function startEditing() {
  if (!recipe.value) return
  editData.value = {
    title: recipe.value.title,
    description: recipe.value.description || "",
    author: recipe.value.author || "",
    prepTime: recipe.value.prepTime || "",
    cookTime: recipe.value.cookTime || "",
    totalTime: recipe.value.totalTime || "",
    freezeTime: recipe.value.freezeTime || "",
    recipeYield: recipe.value.recipeYield || "",
    recipeCategory: recipe.value.recipeCategory || "",
    recipeCuisine: recipe.value.recipeCuisine || "",
    ingredients: [...(recipe.value.ingredients as string[])],
    instructions: [...(recipe.value.instructions as string[])],
    nutrition: recipe.value.nutrition ? { ...recipe.value.nutrition } : {},
    notes: recipe.value.notes || "",
  }
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  editData.value = {}
}

function addIngredient() {
  editData.value.ingredients.push("")
}

function removeIngredient(i: number) {
  editData.value.ingredients.splice(i, 1)
}

function addStep() {
  editData.value.instructions.push("")
}

function removeStep(i: number) {
  editData.value.instructions.splice(i, 1)
}

function addNutritionKey() {
  const key = `item${Object.keys(editData.value.nutrition).length + 1}`
  editData.value.nutrition[key] = ""
}

function removeNutritionKey(key: string) {
  delete editData.value.nutrition[key]
}

async function saveEdit() {
  saving.value = true
  try {
    // Filter out empty ingredients/instructions
    const body = {
      ...editData.value,
      ingredients: editData.value.ingredients.filter((s: string) => s.trim()),
      instructions: editData.value.instructions.filter((s: string) => s.trim()),
      description: editData.value.description || null,
      author: editData.value.author || null,
      prepTime: editData.value.prepTime || null,
      cookTime: editData.value.cookTime || null,
      totalTime: editData.value.totalTime || null,
      freezeTime: editData.value.freezeTime || null,
      recipeYield: editData.value.recipeYield || null,
      recipeCategory: editData.value.recipeCategory || null,
      recipeCuisine: editData.value.recipeCuisine || null,
      nutrition: Object.keys(editData.value.nutrition).length ? editData.value.nutrition : null,
      notes: editData.value.notes || null,
    }
    await $fetch(`/api/recipes/${route.params.id}`, { method: "PATCH", body })
    await refresh()
    editing.value = false
    editData.value = {}
    toast.add({ title: "Recipe updated", color: "success" })
  } catch(e) {
    toast.add({ title: "Failed to save changes", color: "error" })
  } finally {
    saving.value = false
  }
}

// AI Assistant
const aiMode = ref<"review" | "cleanup" | "suggestions">("review")
const aiResult = ref("")
const aiLoading = ref(false)
const aiOpen = ref(false)

const modeOptions = [
  { label: "Review", value: "review", icon: "i-lucide-scan-eye" },
  { label: "Cleanup", value: "cleanup", icon: "i-lucide-sparkles" },
  { label: "Suggestions", value: "suggestions", icon: "i-lucide-lightbulb" },
]

async function runAiReview() {
  aiResult.value = ""
  aiLoading.value = true
  try {
    const res = await $fetch<{ result: string }>(`/api/recipes/${route.params.id}/review`, {
      method: "POST",
      body: { mode: aiMode.value },
    })
    aiResult.value = res.result
  } catch (e: any) {
    toast.add({
      title: "AI review failed",
      description: e.data?.message || "Make sure llama-server is running locally.",
      color: "error",
    })
  } finally {
    aiLoading.value = false
  }
}

// AI Apply
const applyLoading = ref(false)

async function applyAiResult() {
  applyLoading.value = true
  try {
    await $fetch(`/api/recipes/${route.params.id}/apply`, {
      method: "POST",
      body: { aiResponse: aiResult.value, mode: aiMode.value },
    })
    await refresh()
    aiResult.value = ""
    toast.add({ title: "AI suggestions applied", color: "success" })
  } catch (e: any) {
    toast.add({
      title: "Failed to apply AI suggestions",
      description: e.data?.message || "Could not apply changes.",
      color: "error",
    })
  } finally {
    applyLoading.value = false
  }
}

// Nutrition labels
const nutritionLabels: Record<string, string> = {
  calories: "Calories",
  fatContent: "Total Fat",
  saturatedFatContent: "Saturated Fat",
  unsaturatedFatContent: "Unsaturated Fat",
  transFatContent: "Trans Fat",
  carbohydrateContent: "Carbs",
  sugarContent: "Sugar",
  fiberContent: "Fiber",
  proteinContent: "Protein",
  cholesterolContent: "Cholesterol",
  sodiumContent: "Sodium",
  servingSize: "Serving Size",
}

function formatNutritionLabel(key: string): string {
  return nutritionLabels[key] || key.replace(/Content$/, "")
}

// Find-in-recipe search
const searchQuery = ref("")

function highlightText(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escapedQuery})`, "gi")
  return escaped.replace(regex, "<mark>$1</mark>")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Delete
async function deleteRecipe() {
  try {
    await $fetch(`/api/recipes/${route.params.id}`, { method: "DELETE" })
    toast.add({ title: "Recipe deleted", color: "success" })
    await navigateTo("/recipes")
  } catch {
    toast.add({ title: "Failed to delete recipe", color: "error" })
  }
}
</script>

<template>
  <div>
    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="text-muted size-8 animate-spin" />
    </div>

    <div v-else-if="!recipe" class="py-12 text-center">
      <p class="text-muted">Recipe not found.</p>
      <UButton to="/recipes" label="Back to recipes" variant="soft" class="mt-4" />
    </div>

    <article v-else>
      <!-- Hero image -->
      <img
        v-if="recipe.image"
        :src="recipe.image"
        :alt="recipe.title"
        class="mb-6 h-64 w-full rounded-lg object-cover sm:h-80"
      />

      <!-- Header -->
      <div class="mb-6">
        <template v-if="editing">
          <UInput v-model="editData.title" size="lg" class="mb-2 text-3xl font-bold" />
          <UTextarea v-model="editData.description" placeholder="Description" class="mt-2" />
        </template>
        <template v-else>
          <h1 class="text-3xl font-bold">{{ recipe.title }}</h1>
          <p v-if="recipe.description" class="text-muted mt-2">{{ recipe.description }}</p>
        </template>

        <!-- Metadata badges / edit fields -->
        <div v-if="editing" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <UInput v-model="editData.author" placeholder="Author" />
          <UInput v-model="editData.prepTime" placeholder="Prep Time" />
          <UInput v-model="editData.cookTime" placeholder="Cook Time" />
          <UInput v-model="editData.totalTime" placeholder="Total Time" />
          <UInput v-model="editData.freezeTime" placeholder="Additional Time" />
          <UInput v-model="editData.recipeYield" placeholder="Yield" />
          <UInput v-model="editData.recipeCategory" placeholder="Category" />
          <UInput v-model="editData.recipeCuisine" placeholder="Cuisine" />
        </div>
        <div v-else class="mt-4 flex flex-wrap gap-2">
          <UBadge v-if="recipe.author" variant="subtle" color="neutral" icon="i-lucide-user">
            {{ recipe.author }}
          </UBadge>
          <UBadge v-if="recipe.prepTime" variant="subtle" color="neutral" icon="i-lucide-timer">
            Prep: {{ recipe.prepTime }}
          </UBadge>
          <UBadge v-if="recipe.cookTime" variant="subtle" color="neutral" icon="i-lucide-flame">
            Cook: {{ recipe.cookTime }}
          </UBadge>
          <UBadge v-if="recipe.freezeTime" variant="subtle" color="neutral" icon="i-lucide-snowflake">
            Additional: {{ recipe.freezeTime }}
          </UBadge>
          <UBadge v-if="recipe.totalTime" variant="subtle" color="neutral" icon="i-lucide-clock">
            Total: {{ recipe.totalTime }}
          </UBadge>
          <UBadge v-if="recipe.recipeYield" variant="subtle" color="neutral" icon="i-lucide-users">
            {{ recipe.recipeYield }}
          </UBadge>
          <UBadge v-if="recipe.recipeCategory" variant="subtle" color="neutral">
            {{ recipe.recipeCategory }}
          </UBadge>
          <UBadge v-if="recipe.recipeCuisine" variant="subtle" color="neutral">
            {{ recipe.recipeCuisine }}
          </UBadge>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="grid gap-8 lg:grid-cols-3">
        <!-- Ingredients -->
        <div class="lg:col-span-1">
          <h2 class="mb-3 text-xl font-semibold">Ingredients</h2>

          <template v-if="editing">
            <div class="space-y-2">
              <div v-for="(_, i) in editData.ingredients" :key="i" class="flex items-center gap-2">
                <UInput v-model="editData.ingredients[i]" class="flex-1" />
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="removeIngredient(i)"
                />
              </div>
              <UButton
                label="Add Ingredient"
                icon="i-lucide-plus"
                size="xs"
                variant="soft"
                @click="addIngredient"
              />
            </div>
          </template>

          <ul v-else class="space-y-2">
            <li
              v-for="(ingredient, i) in recipe.ingredients"
              :key="i"
              class="border-default flex items-start gap-2 border-b pb-2 last:border-0"
            >
              <UIcon name="i-lucide-circle" class="mt-1.5 size-2 shrink-0" />
              <span v-html="highlightText(ingredient, searchQuery)" />
            </li>
          </ul>
        </div>

        <!-- Instructions -->
        <div class="lg:col-span-2">
          <h2 class="mb-3 text-xl font-semibold">Instructions</h2>

          <template v-if="editing">
            <div class="space-y-3">
              <div v-for="(_, i) in editData.instructions" :key="i" class="flex gap-2">
                <span class="text-muted mt-2 text-sm font-bold">{{ i + 1 }}.</span>
                <UTextarea v-model="editData.instructions[i]" class="flex-1" />
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  color="error"
                  variant="ghost"
                  class="mt-2"
                  @click="removeStep(i)"
                />
              </div>
              <UButton
                label="Add Step"
                icon="i-lucide-plus"
                size="xs"
                variant="soft"
                @click="addStep"
              />
            </div>
          </template>

          <ol v-else class="space-y-4">
            <li v-for="(step, i) in recipe.instructions" :key="i" class="flex gap-3">
              <span
                class="bg-primary text-inverted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              >
                {{ i + 1 }}
              </span>
              <p class="pt-0.5" v-html="highlightText(step, searchQuery)" />
            </li>
          </ol>
        </div>
      </div>

      <!-- Nutrition Facts -->
      <div v-if="editing || recipe.nutrition" class="mt-8">
        <h2 class="mb-3 text-xl font-semibold">Nutrition Facts</h2>

        <template v-if="editing">
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div
              v-for="(value, key) in editData.nutrition"
              :key="key"
              class="flex items-center gap-2"
            >
              <UInput :model-value="key" disabled size="sm" class="w-28" />
              <UInput v-model="editData.nutrition[key]" size="sm" class="flex-1" />
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="error"
                variant="ghost"
                @click="removeNutritionKey(key as string)"
              />
            </div>
          </div>
          <UButton
            label="Add Nutrition Field"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            class="mt-2"
            @click="addNutritionKey"
          />
        </template>

        <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          <div
            v-for="(value, key) in recipe.nutrition"
            :key="key"
            class="bg-muted/50 rounded-md px-3 py-2"
          >
            <p class="text-muted text-xs">{{ formatNutritionLabel(key as string) }}</p>
            <p class="font-semibold">{{ value }}</p>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="editing || recipe.notes" class="mt-8">
        <h2 class="mb-3 text-xl font-semibold">Notes</h2>
        <UTextarea v-if="editing" v-model="editData.notes" placeholder="Recipe notes..." />
        <p v-else class="text-muted">{{ recipe.notes }}</p>
      </div>

      <!-- AI Assistant -->
      <div class="mt-8">
        <UButton
          :label="aiOpen ? 'Hide AI Assistant' : 'AI Assistant'"
          variant="outline"
          icon="i-lucide-bot"
          @click="aiOpen = !aiOpen"
        />

        <div v-if="aiOpen" class="mt-4">
          <UCard>
            <div class="flex flex-col gap-4">
              <p class="text-muted text-sm">Powered by a local Qwen3-4B model via llama.cpp.</p>

              <div class="flex flex-wrap items-end gap-3">
                <URadioGroup v-model="aiMode" :items="modeOptions" orientation="horizontal" />
                <UButton
                  label="Analyze"
                  icon="i-lucide-sparkles"
                  :loading="aiLoading"
                  @click="runAiReview"
                />
              </div>

              <div v-if="aiResult" class="bg-muted/50 rounded-md p-4">
                <p class="text-sm whitespace-pre-wrap">{{ aiResult }}</p>
                <UButton
                  label="Apply to Recipe"
                  icon="i-lucide-check"
                  variant="soft"
                  size="sm"
                  class="mt-3"
                  :loading="applyLoading"
                  @click="applyAiResult"
                />
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Add to Cookbook -->
      <div v-if="allCookbooks?.length" class="mt-8">
        <h2 class="mb-3 text-xl font-semibold">Cookbooks</h2>
        <div class="flex flex-wrap gap-2">
          <template v-for="cb in allCookbooks" :key="cb.id">
            <UButton
              v-if="recipeCookbookIds.has(cb.id)"
              :label="cb.name"
              icon="i-lucide-check"
              variant="soft"
              size="sm"
              @click="removeFromCookbook(cb.id)"
            />
            <UButton
              v-else
              :label="cb.name"
              icon="i-lucide-plus"
              variant="outline"
              size="sm"
              @click="addToCookbook(cb.id)"
            />
          </template>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="border-default mt-8 flex items-center justify-between border-t pt-6">
        <div class="flex items-center gap-2">
          <UButton
            :to="recipe.url"
            target="_blank"
            label="View Original"
            variant="outline"
            icon="i-lucide-external-link"
          />
          <template v-if="editing">
            <UButton
              label="Save"
              icon="i-lucide-save"
              :loading="saving"
              @click="saveEdit"
            />
            <UButton
              label="Cancel"
              variant="outline"
              @click="cancelEditing"
            />
          </template>
          <UButton
            v-else
            label="Edit Recipe"
            variant="outline"
            icon="i-lucide-pencil"
            @click="startEditing"
          />
        </div>
        <UButton
          label="Delete Recipe"
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          @click="deleteRecipe"
        />
      </div>

      <!-- FAB for find-in-recipe -->
      <RecipeFAB @search="searchQuery = $event" @clear-search="searchQuery = ''" />
    </article>
  </div>
</template>
