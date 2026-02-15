import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(10),
  token: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)

  await verifyTurnstileToken(body.token)

  // TODO: handle the contact form submission
  // e.g. send an email, store in a database, forward to a webhook, etc.

  return { success: true }
})
