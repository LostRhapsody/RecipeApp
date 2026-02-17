import { ofetch } from "ofetch"

export type LLMProvider = "local" | "cloud"

interface LLMOptions {
  /** Disable <think> reasoning for structured output tasks */
  noThink?: boolean
  temperature?: number
  maxTokens?: number
  /** Which provider to use (default: "local") */
  provider?: LLMProvider
  /** Request JSON output format from the model (not all models support this) */
  jsonMode?: boolean
}

const OPENROUTER_BASE = "https://openrouter.ai/api"
const OPENROUTER_MODEL = "arcee-ai/trinity-large-preview:free"
const LOCAL_MODEL = "qwen3-4b-instruct"

/**
 * Shared helper for calling an OpenAI-compatible LLM API.
 * Supports both the local llama.cpp server and OpenRouter cloud.
 * Returns the cleaned response text, or throws with a descriptive error.
 */
export async function callLLM(system: string, user: string, opts?: LLMOptions): Promise<string> {
  const { llamaBaseUrl, openrouterApiKey } = useRuntimeConfig()
  const provider = opts?.provider ?? "local"

  if (provider === "cloud" && !openrouterApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage:
        "OpenRouter API key is not configured. Set the NUXT_OPENROUTER_API_KEY environment variable.",
    })
  }

  const isLocal = provider === "local"
  const baseUrl = isLocal ? llamaBaseUrl : OPENROUTER_BASE
  const model = isLocal ? LOCAL_MODEL : OPENROUTER_MODEL

  // Qwen3 supports /no_think suffix to skip reasoning (local only)
  const userContent = opts?.noThink && isLocal ? `${user} /no_think` : user

  const headers: Record<string, string> = {}
  if (!isLocal) {
    headers["Authorization"] = `Bearer ${openrouterApiKey}`
    headers["HTTP-Referer"] = "https://justtherecipe.app"
    headers["X-Title"] = "Just the Recipe"
  }

  const url: string = `${baseUrl}/v1/chat/completions`
  let res: { choices: { message: { content: string } }[] }
  try {
    res = await ofetch(url, {
      method: "POST",
      timeout: 120_000,
      headers,
      body: {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.2,
        top_p: 0.9,
        ...(opts?.jsonMode ? { response_format: { type: "json_object" } } : {}),
      },
    })
  } catch (err: any) {
    if (isLocal && (err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED")) {
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
