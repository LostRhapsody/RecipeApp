import { betterAuth } from "better-auth"

export const auth = betterAuth({
  // TODO: Add a database adapter for your project
  // Example with SQLite:
  //   database: new Database("sqlite.db")
  // See: https://www.better-auth.com/docs/concepts/database
})
