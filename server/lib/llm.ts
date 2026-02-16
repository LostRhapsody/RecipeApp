/**
 * Shared helper for calling the local llama.cpp OpenAI-compatible API.
 * Returns the cleaned response text, or null if the server is unavailable.
 */
export async function callLLM(system: string, user: string): Promise<string | null> {
  const { llamaBaseUrl } = useRuntimeConfig()

  const res = await $fetch<{
    choices: { message: { content: string } }[]
  }>(`${llamaBaseUrl}/v1/chat/completions`, {
    method: "POST",
    body: {
      model: "qwen3-4b-instruct",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 4096,
      temperature: 0.4,
      top_p: 0.9,
    },
  }).catch(() => null)

  if (!res) return null

  const content = res.choices?.[0]?.message?.content ?? ""

  // Strip <think>...</think> blocks from reasoning models
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || null
}
