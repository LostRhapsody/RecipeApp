<script setup lang="ts">
defineProps<{
  cookbook: {
    id: number
    name: string
    description: string | null
    recipeCount: number
  }
}>()
</script>

<template>
  <NuxtLink :to="`/cookbooks/${cookbook.id}`" class="group block">
    <UCard class="h-full transition-shadow group-hover:shadow-lg">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">{{ cookbook.name }}</h3>
          <UBadge variant="subtle" color="neutral">
            {{ cookbook.recipeCount }} {{ cookbook.recipeCount === 1 ? "recipe" : "recipes" }}
          </UBadge>
        </div>
        <p v-if="cookbook.description" class="text-muted text-sm line-clamp-2">
          {{ cookbook.description }}
        </p>
      </div>
    </UCard>
  </NuxtLink>
</template>
