<script setup lang="ts">
const route = useRoute()
const toast = useToast()

const { data: recipe, status } = useFetch(`/api/recipes/${route.params.id}`)

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
        <h1 class="text-3xl font-bold">{{ recipe.title }}</h1>
        <p v-if="recipe.description" class="text-muted mt-2">{{ recipe.description }}</p>

        <!-- Metadata badges -->
        <div class="mt-4 flex flex-wrap gap-2">
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
          <ul class="space-y-2">
            <li
              v-for="(ingredient, i) in recipe.ingredients"
              :key="i"
              class="border-default flex items-start gap-2 border-b pb-2 last:border-0"
            >
              <UIcon name="i-lucide-circle" class="mt-1.5 size-2 shrink-0" />
              <span>{{ ingredient }}</span>
            </li>
          </ul>
        </div>

        <!-- Instructions -->
        <div class="lg:col-span-2">
          <h2 class="mb-3 text-xl font-semibold">Instructions</h2>
          <ol class="space-y-4">
            <li v-for="(step, i) in recipe.instructions" :key="i" class="flex gap-3">
              <span
                class="bg-primary text-inverted flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              >
                {{ i + 1 }}
              </span>
              <p class="pt-0.5">{{ step }}</p>
            </li>
          </ol>
        </div>
      </div>

      <!-- Nutrition Facts -->
      <div v-if="recipe.nutrition" class="mt-8">
        <h2 class="mb-3 text-xl font-semibold">Nutrition Facts</h2>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
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
      <div v-if="recipe.notes" class="mt-8">
        <h2 class="mb-3 text-xl font-semibold">Notes</h2>
        <p class="text-muted">{{ recipe.notes }}</p>
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
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="border-default mt-8 flex items-center justify-between border-t pt-6">
        <UButton
          :to="recipe.url"
          target="_blank"
          label="View Original"
          variant="outline"
          icon="i-lucide-external-link"
        />
        <UButton
          label="Delete Recipe"
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          @click="deleteRecipe"
        />
      </div>
    </article>
  </div>
</template>
