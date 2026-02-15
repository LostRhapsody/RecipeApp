<script setup lang="ts">
const { data: recipes, status } = useFetch("/api/recipes")
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

    <div v-else-if="!recipes?.length" class="py-12 text-center">
      <UIcon name="i-lucide-book-open" class="text-muted mx-auto size-12" />
      <p class="text-muted mt-4">No recipes saved yet.</p>
      <UButton to="/" label="Add your first recipe" variant="soft" class="mt-4" />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RecipeCard v-for="recipe in recipes" :key="recipe.id" :recipe="recipe" />
    </div>
  </div>
</template>
