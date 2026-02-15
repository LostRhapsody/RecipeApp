<template>
  <div class="bg-default min-h-screen">
    <header class="border-default border-b">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="text-lg font-bold">Just the Recipe</NuxtLink>
        <nav class="flex items-center gap-4">
          <UButton to="/" variant="ghost" label="Home" />
          <UButton to="/recipes" variant="ghost" label="Recipes" />
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-4xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>
