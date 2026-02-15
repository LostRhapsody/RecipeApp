<script setup lang="ts">
import { z } from "zod"
import type { FormSubmitEvent } from "@nuxt/ui"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: "",
  email: "",
  message: "",
})

const token = ref("")
const submitted = ref(false)
const error = ref("")

async function onSubmit(event: FormSubmitEvent<Schema>) {
  error.value = ""

  if (!token.value) {
    error.value = "Please complete the captcha."
    return
  }

  try {
    await $fetch("/api/contact", {
      method: "POST",
      body: {
        ...event.data,
        token: token.value,
      },
    })
    submitted.value = true
  } catch (e: any) {
    error.value = e.data?.message || "Something went wrong. Please try again."
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-md">
    <div v-if="submitted" class="text-center">
      <UIcon name="i-lucide-check-circle" class="text-success mx-auto size-12" />
      <h3 class="mt-4 text-lg font-semibold">Message sent!</h3>
      <p class="text-muted mt-1">We'll get back to you soon.</p>
    </div>

    <UForm v-else :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
      <UFormField label="Name" name="name" required>
        <UInput v-model="state.name" placeholder="Your name" class="w-full" />
      </UFormField>

      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" type="email" placeholder="you@example.com" class="w-full" />
      </UFormField>

      <UFormField label="Message" name="message" required>
        <UTextarea
          v-model="state.message"
          placeholder="How can we help?"
          :rows="4"
          autoresize
          class="w-full"
        />
      </UFormField>

      <NuxtTurnstile v-model="token" />

      <p v-if="error" class="text-error text-sm">{{ error }}</p>

      <UButton type="submit" label="Send message" loading-auto class="self-start" />
    </UForm>
  </div>
</template>
