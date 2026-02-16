<script setup lang="ts">
const route = useRoute()
const toast = useToast()

const { data: cookbook, status, refresh } = useFetch(`/api/cookbooks/${route.params.id}`)

// Rename
const editingName = ref(false)
const editName = ref("")
const editDescription = ref("")

function startRename() {
  if (!cookbook.value) return
  editName.value = cookbook.value.name
  editDescription.value = cookbook.value.description || ""
  editingName.value = true
}

async function saveRename() {
  try {
    await $fetch(`/api/cookbooks/${route.params.id}`, {
      method: "PATCH",
      body: {
        name: editName.value.trim(),
        description: editDescription.value.trim() || null,
      },
    })
    await refresh()
    editingName.value = false
    toast.add({ title: "Cookbook updated", color: "success" })
  } catch {
    toast.add({ title: "Failed to update cookbook", color: "error" })
  }
}

async function removeRecipe(recipeId: number) {
  try {
    await $fetch(`/api/cookbooks/${route.params.id}/recipes`, {
      method: "DELETE",
      body: { recipeId },
    })
    await refresh()
    toast.add({ title: "Recipe removed from cookbook", color: "success" })
  } catch {
    toast.add({ title: "Failed to remove recipe", color: "error" })
  }
}

async function deleteCookbook() {
  try {
    await $fetch(`/api/cookbooks/${route.params.id}`, { method: "DELETE" })
    toast.add({ title: "Cookbook deleted", color: "success" })
    await navigateTo("/cookbooks")
  } catch {
    toast.add({ title: "Failed to delete cookbook", color: "error" })
  }
}
</script>

<template>
  <div>
    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="text-muted size-8 animate-spin" />
    </div>

    <div v-else-if="!cookbook" class="py-12 text-center">
      <p class="text-muted">Cookbook not found.</p>
      <UButton to="/cookbooks" label="Back to cookbooks" variant="soft" class="mt-4" />
    </div>

    <div v-else>
      <!-- Header -->
      <div class="mb-6">
        <template v-if="editingName">
          <div class="flex flex-col gap-3">
            <UInput v-model="editName" size="lg" />
            <UTextarea v-model="editDescription" placeholder="Description (optional)" />
            <div class="flex gap-2">
              <UButton label="Save" @click="saveRename" />
              <UButton label="Cancel" variant="outline" @click="editingName = false" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold">{{ cookbook.name }}</h1>
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              @click="startRename"
            />
          </div>
          <p v-if="cookbook.description" class="text-muted mt-1">{{ cookbook.description }}</p>
        </template>
      </div>

      <!-- Recipes -->
      <div v-if="!cookbook.recipes.length" class="py-12 text-center">
        <UIcon name="i-lucide-book-open" class="text-muted mx-auto size-12" />
        <p class="text-muted mt-4">No recipes in this cookbook yet.</p>
        <UButton to="/recipes" label="Browse recipes" variant="soft" class="mt-4" />
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="recipe in cookbook.recipes" :key="recipe.id" class="relative">
          <RecipeCard :recipe="recipe" />
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="error"
            variant="soft"
            class="absolute right-2 top-2 z-10"
            @click.prevent="removeRecipe(recipe.id)"
          />
        </div>
      </div>

      <!-- Footer -->
      <div class="border-default mt-8 flex items-center justify-between border-t pt-6">
        <UButton to="/cookbooks" label="All Cookbooks" variant="outline" icon="i-lucide-arrow-left" />
        <UButton
          label="Delete Cookbook"
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          @click="deleteCookbook"
        />
      </div>
    </div>
  </div>
</template>
