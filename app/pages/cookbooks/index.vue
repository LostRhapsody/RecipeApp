<script setup lang="ts">
const toast = useToast()
const { data: cookbooks, status, refresh } = useFetch("/api/cookbooks")

const showCreate = ref(false)
const newName = ref("")
const newDescription = ref("")
const creating = ref(false)

async function createCookbook() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    await $fetch("/api/cookbooks", {
      method: "POST",
      body: { name: newName.value.trim(), description: newDescription.value.trim() || undefined },
    })
    await refresh()
    showCreate.value = false
    newName.value = ""
    newDescription.value = ""
    toast.add({ title: "Cookbook created", color: "success" })
  } catch {
    toast.add({ title: "Failed to create cookbook", color: "error" })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Cookbooks</h1>
      <UButton label="Create Cookbook" icon="i-lucide-plus" @click="showCreate = true" />
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="text-muted size-8 animate-spin" />
    </div>

    <div v-else-if="!cookbooks?.length" class="py-12 text-center">
      <UIcon name="i-lucide-library" class="text-muted mx-auto size-12" />
      <p class="text-muted mt-4">No cookbooks yet.</p>
      <UButton
        label="Create your first cookbook"
        variant="soft"
        class="mt-4"
        @click="showCreate = true"
      />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <CookbookCard v-for="cookbook in cookbooks" :key="cookbook.id" :cookbook="cookbook" />
    </div>

    <!-- Create modal -->
    <UModal v-model:open="showCreate">
      <template #content>
        <div class="p-6">
          <h2 class="mb-4 text-lg font-semibold">Create Cookbook</h2>
          <div class="flex flex-col gap-3">
            <UInput v-model="newName" placeholder="Cookbook name" autofocus />
            <UTextarea v-model="newDescription" placeholder="Description (optional)" />
            <div class="flex justify-end gap-2">
              <UButton label="Cancel" variant="outline" @click="showCreate = false" />
              <UButton label="Create" :loading="creating" @click="createCookbook" />
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
