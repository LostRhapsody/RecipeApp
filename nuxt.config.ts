// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/seo", "@nuxtjs/turnstile", "@vueuse/nuxt"],

  css: ["~/assets/css/main.css"],

  turnstile: {
    siteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  },

  runtimeConfig: {
    turnstile: {
      secretKey: "",
    },
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000",
    name: "My Site",
  },
})
