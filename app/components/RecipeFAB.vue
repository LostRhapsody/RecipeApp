<script setup lang="ts">
const emit = defineEmits<{
  search: [query: string]
  clearSearch: []
}>()

const open = ref(false)
const searching = ref(false)
const query = ref("")

function startSearch() {
  searching.value = true
  open.value = false
}

function closeSearch() {
  query.value = ""
  searching.value = false
  emit("clearSearch")
}

watch(query, (val) => {
  emit("search", val)
})
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50">
    <!-- Search panel -->
    <div
      v-if="searching"
      class="bg-default border-default flex items-center gap-2 rounded-lg border p-2 shadow-lg"
    >
      <UIcon name="i-lucide-search" class="text-muted size-5 shrink-0" />
      <input
        v-model="query"
        type="text"
        placeholder="Find in recipe..."
        class="bg-transparent text-sm outline-none"
        autofocus
      />
      <UButton
        icon="i-lucide-x"
        size="xs"
        variant="ghost"
        @click="closeSearch"
      />
    </div>

    <!-- FAB button -->
    <UPopover v-else v-model:open="open" :content="{ side: 'top', align: 'end' }">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        size="lg"
        class="rounded-full shadow-lg"
      />

      <template #content>
        <div class="p-1">
          <UButton
            label="Find in Recipe"
            icon="i-lucide-search"
            variant="ghost"
            block
            @click="startSearch"
          />
        </div>
      </template>
    </UPopover>
  </div>
</template>
