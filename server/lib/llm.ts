interface LLMOptions {
  /** Disable <think> reasoning for structured output tasks */
  noThink?: boolean
  temperature?: number
  maxTokens?: number
}

/**
 * Shared helper for calling the local llama.cpp OpenAI-compatible API.
 * Returns the cleaned response text, or throws with a descriptive error.
 */
export async function callLLM(system: string, user: string, opts?: LLMOptions): Promise<string> {
  const { llamaBaseUrl } = useRuntimeConfig()

  // Qwen3 supports /no_think suffix to skip reasoning
  const userContent = opts?.noThink ? `${user} /no_think` : user

  let res: { choices: { message: { content: string } }[] }
  try {
    res = await $fetch(`${llamaBaseUrl}/v1/chat/completions`, {
      method: "POST",
      timeout: 120_000,
      body: {
        model: "qwen3-4b-instruct",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.4,
        top_p: 0.9,
      },
    })
  } catch (err: any) {
    if (err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED") {
      throw createError({
        statusCode: 503,
        statusMessage: "Local LLM server is not running. Start llama-server first.",
      })
    }
    throw createError({
      statusCode: 504,
      statusMessage: `LLM request failed: ${err?.message || "unknown error"}`,
    })
  }

  const content = res.choices?.[0]?.message?.content ?? ""

  // Strip <think>...</think> blocks from reasoning models
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim()
  if (!cleaned) {
    throw createError({
      statusCode: 502,
      statusMessage: "LLM returned an empty response. Try again.",
    })
  }

  return cleaned
}
