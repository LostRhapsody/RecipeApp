<script setup lang="ts">
import type { Recipe } from "~~/server/database/schema"

type RecipeData = Omit<Recipe, "createdAt"> & { createdAt: string | Date }

defineProps<{
  recipe: RecipeData
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  toggle: [id: number]
}>()
</script>

<template>
  <component
    :is="selectable ? 'div' : NuxtLink"
    :to="selectable ? undefined : `/recipes/${recipe.id}`"
    class="group block"
    :class="selectable ? 'cursor-pointer' : ''"
    @click="selectable ? emit('toggle', recipe.id) : undefined"
  >
    <UCard
      class="h-full transition-shadow"
      :class="[selected ? 'ring-primary ring-2' : 'group-hover:shadow-lg']"
    >
      <div class="flex flex-col gap-3">
        <div class="relative">
          <img
            v-if="recipe.image"
            :src="recipe.image"
            :alt="recipe.title"
            class="h-40 w-full rounded-md object-cover"
          />
          <div v-else class="bg-muted flex h-40 w-full items-center justify-center rounded-md">
            <UIcon name="i-lucide-chef-hat" class="text-muted size-10" />
          </div>
          <div
            v-if="selectable"
            class="absolute top-2 left-2"
            @click.stop="emit('toggle', recipe.id)"
          >
            <UCheckbox :model-value="selected" tabindex="-1" />
          </div>
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
  </component>
</template>
