export type PlatformAgentChatProvider = "mock" | "openai";
export type PlatformAgentChatEngine = "mock-agent" | "openai";

export interface PlatformAgentChatLlmConfig {
  provider: PlatformAgentChatProvider;
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

export interface PlatformAgentChatInput {
  agentId: string;
  orderId: string;
  gatewayLeaseToken: string;
  message: string;
  locale: "zh" | "en";
}

export interface PlatformAgentChatResponse {
  agentId: string;
  answer: string;
  engine: PlatformAgentChatEngine;
  model: string;
  safetyNotice: string;
}

export interface PlatformAgentChatClient {
  engine: PlatformAgentChatEngine;
  model: string;
  invoke(input: PlatformAgentChatInput): Promise<PlatformAgentChatResponse>;
}

export type AgentChatFetchLike = typeof fetch;

const OPENAI_COMPATIBLE_DEFAULT_BASE_URL = "https://api.openai.com";
const DEFAULT_AGENT_CHAT_MODEL = "gpt-5.5";
const DEFAULT_AGENT_CHAT_TIMEOUT_MS = 45_000;

export function createPlatformAgentChatClient(
  config: PlatformAgentChatLlmConfig,
  fetchImpl: AgentChatFetchLike = fetch
): PlatformAgentChatClient {
  if (config.provider === "mock") {
    return createMockPlatformAgentChatClient();
  }
  return createOpenAiCompatibleAgentChatClient(config, fetchImpl);
}

export function createMockPlatformAgentChatClient(): PlatformAgentChatClient {
  return {
    engine: "mock-agent",
    model: "mock",
    async invoke(input: PlatformAgentChatInput): Promise<PlatformAgentChatResponse> {
      return {
        agentId: input.agentId,
        answer: [
          "后端尚未配置真实 LLM key。真实路演时请用 PLATFORM_AGENT_LLM_* 环境变量启动 Platform API。",
          `当前已校验租赁订单 ${input.orderId} 和 Gateway lease，可以替换为真实模型回复。`
        ].join("\n"),
        engine: "mock-agent",
        model: "mock",
        safetyNotice: buildSafetyNotice(input.locale)
      };
    }
  };
}

function createOpenAiCompatibleAgentChatClient(
  config: PlatformAgentChatLlmConfig,
  fetchImpl: AgentChatFetchLike
): PlatformAgentChatClient {
  if (!config.apiKey) {
    throw new Error("PLATFORM_AGENT_LLM_API_KEY is required for openai provider.");
  }
  const model = config.model ?? DEFAULT_AGENT_CHAT_MODEL;

  return {
    engine: "openai",
    model,
    async invoke(input: PlatformAgentChatInput): Promise<PlatformAgentChatResponse> {
      const timeoutMs = config.timeoutMs ?? DEFAULT_AGENT_CHAT_TIMEOUT_MS;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response | null = null;

      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          response = await fetchImpl(buildChatCompletionsUrl(config.apiBaseUrl), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${config.apiKey}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              temperature: 0.25,
              max_tokens: 500,
              messages: [
                {
                  role: "system",
                  content: buildExpertAgentSystemPrompt(input.agentId, input.locale)
                },
                {
                  role: "user",
                  content: buildExpertAgentUserPrompt(input)
                }
              ]
            })
          });

          if (response.ok) {
            break;
          }
          const errorBody = await response.text();
          if (attempt === 1 || !isRetryableAgentLlmError(response.status, errorBody)) {
            throw new Error(`Agent LLM request failed with status ${response.status}: ${errorBody.slice(0, 300)}`);
          }
          await delay(1_200);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Agent LLM request timed out after ${timeoutMs}ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response?.ok) {
        throw new Error("Agent LLM request failed before a response was returned.");
      }

      return {
        agentId: input.agentId,
        answer: parseOpenAiCompatibleAnswer(await response.text()),
        engine: "openai",
        model,
        safetyNotice: buildSafetyNotice(input.locale)
      };
    }
  };
}

function isRetryableAgentLlmError(status: number, body: string): boolean {
  return status === 429 || body.includes("system_cpu_overloaded") || body.includes("rate_limit");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildChatCompletionsUrl(apiBaseUrl: string | undefined): string {
  const baseUrl = (apiBaseUrl ?? OPENAI_COMPATIBLE_DEFAULT_BASE_URL).replace(/\/+$/, "");
  return baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
}

function buildExpertAgentSystemPrompt(agentId: string, locale: "zh" | "en"): string {
  if (agentId !== "expert-criminal-defense") {
    return [
      "You are an expert Agent listed on AgentLens.",
      "Help the buyer turn their question into practical next steps, while making uncertainty and risk explicit.",
      "Do not claim professional certification unless it is present in the supplied Agent profile."
    ].join("\n");
  }

  const languageInstruction = locale === "zh"
    ? "请使用中文回答，语气像一位严谨的一线刑辩律师助手。"
    : "Answer in English, in the voice of a careful criminal-defense assistant.";

  return [
    languageInstruction,
    "你是 AgentLens 上的“无罪辩点·刑辩数字律师”，只做刑事案件辩点梳理辅助。",
    "不要替代律师、不要承诺结果、不要编造事实或法条；信息不足时直接列待补充事实。",
    "用简洁结构输出：案情理解 / 可探索辩点 / 证据与程序核查 / 问律师的问题 / 风险提示。",
    "不要使用 Markdown 符号，标题直接写中文短句加冒号。",
    "回答要具体到可核查清单，控制在 600 字以内。"
  ].join("\n");
}

function buildExpertAgentUserPrompt(input: PlatformAgentChatInput): string {
  return [
    "用户已通过 AgentLens Gateway lease 租赁本 Agent。请回答以下问题：",
    input.message
  ].join("\n");
}

function parseOpenAiCompatibleAnswer(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:")) {
    const answer = parseSseAnswer(trimmed);
    if (answer) return answer;
  }

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const outputText = typeof parsed.output_text === "string" ? parsed.output_text : "";
  const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const content = extractTextContent(message?.content) || outputText;
  if (!content) {
    throw new Error("Agent LLM response has no content.");
  }
  return content.trim();
}

function parseSseAnswer(raw: string): string {
  let content = "";
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const message = choice?.message as Record<string, unknown> | undefined;
    const delta = choice?.delta as Record<string, unknown> | undefined;
    content += extractTextContent(message?.content) || extractTextContent(delta?.content);
  }
  return content.trim();
}

function extractTextContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      const record = item as Record<string, unknown>;
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .join("");
}

function buildSafetyNotice(locale: "zh" | "en"): string {
  return locale === "zh"
    ? "本回复用于辅助梳理争议焦点，不构成正式法律意见，具体案件请由持证律师确认。"
    : "This response helps structure defense issues and is not formal legal advice; a licensed lawyer must confirm case-specific action.";
}
