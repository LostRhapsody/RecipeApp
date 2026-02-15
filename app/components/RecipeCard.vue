<script setup lang="ts">
import type { Recipe } from "~~/server/database/schema"

defineProps<{ recipe: Recipe }>()
</script>

<template>
  <NuxtLink :to="`/recipes/${recipe.id}`" class="group block">
    <UCard class="h-full transition-shadow group-hover:shadow-lg">
      <div class="flex flex-col gap-3">
        <img
          v-if="recipe.image"
          :src="recipe.image"
          :alt="recipe.title"
          class="h-40 w-full rounded-md object-cover"
        />
        <div v-else class="bg-muted flex h-40 w-full items-center justify-center rounded-md">
          <UIcon name="i-lucide-chef-hat" class="text-muted size-10" />
        </div>
        <h3 class="line-clamp-2 font-semibold">{{ recipe.title }}</h3>
        <div class="text-muted flex flex-wrap gap-2 text-sm">
          <UBadge v-if="recipe.totalTime" variant="subtle" color="neutral">
            {{ recipe.totalTime }}
          </UBadge>
          <UBadge v-if="recipe.recipeCategory" variant="subtle" color="neutral">
            {{ recipe.recipeCategory }}
          </UBadge>
          <UBadge v-if="recipe.recipeCuisine" variant="subtle" color="neutral">
            {{ recipe.recipeCuisine }}
          </UBadge>
        </div>
      </div>
    </UCard>
  </NuxtLink>
</template>
