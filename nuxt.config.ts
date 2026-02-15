// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/seo", "@vueuse/nuxt"],

  icon: {
    // Workaround: local server bundle generates bare Windows paths (missing file:// prefix)
    // causing "Received protocol 'c:'" ESM loader errors
    serverBundle: "remote",
  },

  css: ["~/assets/css/main.css"],

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000",
    name: "Just the Recipe",
  },

  runtimeConfig: {
    llamaBaseUrl: "http://127.0.0.1:8081",
  }
})
