<script setup lang="ts">
import { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"

const schema = z.object({
  url: z.string().url("Please enter a valid recipe URL"),
})

type Schema = z.output<typeof schema>

const state = reactive({ url: "" })
const loading = ref(false)
const useAI = ref(false)
const statusMessage = ref("")
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    statusMessage.value = "Fetching recipe..."
    const recipe = await $fetch("/api/recipes/scrape", {
      method: "POST",
      body: { url: event.data.url },
    })

    if (useAI.value && recipe.isNew) {
      statusMessage.value = "Improving with AI..."
      await $fetch(`/api/recipes/${recipe.id}/cleanup`, { method: "POST" })
    }

    await navigateTo(`/recipes/${recipe.id}`)
  } catch (e: any) {
    toast.add({
      title: "Failed to scrape recipe",
      description: e.data?.message || "Could not extract recipe from that URL.",
      color: "error",
    })
  } finally {
    loading.value = false
    statusMessage.value = ""
  }
}
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center">
    <div class="w-full max-w-lg text-center">
      <h1 class="text-4xl font-bold">Just the Recipe</h1>
      <p class="text-muted mt-2 text-lg">Paste a recipe URL to extract just the good stuff.</p>

      <UForm :schema="schema" :state="state" class="mt-8 flex flex-col gap-4" @submit="onSubmit">
        <UFormField name="url">
          <UInput
            v-model="state.url"
            placeholder="https://example.com/recipe..."
            size="lg"
            class="w-full"
            :disabled="loading"
          />
        </UFormField>
        <div class="flex items-center justify-center gap-2">
          <USwitch v-model="useAI" :disabled="loading" />
          <span class="text-sm">Improve with AI</span>
        </div>
        <UButton
          type="submit"
          label="Get Recipe"
          size="lg"
          :loading="loading"
          class="self-center"
        />
        <p v-if="statusMessage" class="text-muted animate-pulse text-sm">
          {{ statusMessage }}
        </p>
      </UForm>
    </div>
  </div>
</template>
