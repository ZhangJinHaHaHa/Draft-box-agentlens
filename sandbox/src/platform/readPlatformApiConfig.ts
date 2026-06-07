import path from "node:path";

import type { PlatformAgentChatLlmConfig } from "./agentChatClient";
import type { RecommendationLlmConfig } from "../recommendation/recommendationLlmClient";
import { resolvePlatformApiStateDir } from "./persistentPlatformApiStore";

export interface PlatformApiConfig {
  host: string;
  port: number;
  stateDir: string;
  recommendationCostCredits: number;
  recommendationCatalogPath?: string;
  recommendationLlm: RecommendationLlmConfig;
  agentChatLlm: PlatformAgentChatLlmConfig;
}

export function readPlatformApiConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): PlatformApiConfig {
  const recommendationCatalogPath = readOptionalString(env.PLATFORM_RECOMMENDATION_CATALOG_PATH);

  return {
    host: readOptionalString(env.PLATFORM_API_HOST) ?? "127.0.0.1",
    port: readPort(env.PLATFORM_API_PORT, 8790),
    stateDir: resolvePlatformApiStateDir(readOptionalString(env.PLATFORM_API_STATE_DIR)),
    recommendationCostCredits: readPositiveInt(
      env.PLATFORM_LLM_RECOMMENDATION_COST_CREDITS,
      3,
      "PLATFORM_LLM_RECOMMENDATION_COST_CREDITS"
    ),
    ...(recommendationCatalogPath ? { recommendationCatalogPath: path.resolve(recommendationCatalogPath) } : {}),
    recommendationLlm: readRecommendationLlmConfig(env),
    agentChatLlm: readAgentChatLlmConfig(env)
  };
}

function readOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readAgentChatLlmConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): PlatformAgentChatLlmConfig {
  const provider = readOptionalString(env.PLATFORM_AGENT_LLM_PROVIDER) ?? "mock";
  if (provider !== "mock" && provider !== "openai") {
    throw new Error("PLATFORM_AGENT_LLM_PROVIDER must be mock or openai.");
  }

  if (provider === "mock") {
    return { provider };
  }

  const apiKey = readOptionalString(env.PLATFORM_AGENT_LLM_API_KEY);
  const model = readOptionalString(env.PLATFORM_AGENT_LLM_MODEL) ?? "gpt-5.5";
  const apiBaseUrl = readOptionalString(env.PLATFORM_AGENT_LLM_API_BASE_URL);
  const timeoutMs = readPositiveInt(
    env.PLATFORM_AGENT_LLM_TIMEOUT_MS,
    45_000,
    "PLATFORM_AGENT_LLM_TIMEOUT_MS"
  );

  return {
    provider,
    ...(apiKey ? { apiKey } : {}),
    model,
    ...(apiBaseUrl ? { apiBaseUrl } : {}),
    timeoutMs
  };
}

function readPort(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error("PLATFORM_API_PORT must be a positive integer.");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PLATFORM_API_PORT must be between 1 and 65535.");
  }
  return port;
}

function readPositiveInt(value: string | undefined, fallback: number, key: string): number {
  if (!value || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${key} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
}

function readRecommendationLlmConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): RecommendationLlmConfig {
  const provider = readOptionalString(env.PLATFORM_RECOMMENDATION_LLM_PROVIDER) ?? "mock";
  if (provider !== "mock" && provider !== "openai") {
    throw new Error("PLATFORM_RECOMMENDATION_LLM_PROVIDER must be mock or openai.");
  }

  if (provider === "mock") {
    return { provider };
  }

  const apiKey = readOptionalString(env.PLATFORM_RECOMMENDATION_LLM_API_KEY);
  const model = readOptionalString(env.PLATFORM_RECOMMENDATION_LLM_MODEL);
  const apiBaseUrl = readOptionalString(env.PLATFORM_RECOMMENDATION_LLM_API_BASE_URL);
  const timeoutMs = readPositiveInt(
    env.PLATFORM_RECOMMENDATION_LLM_TIMEOUT_MS,
    30_000,
    "PLATFORM_RECOMMENDATION_LLM_TIMEOUT_MS"
  );

  return {
    provider,
    ...(apiKey ? { apiKey } : {}),
    ...(model ? { model } : {}),
    ...(apiBaseUrl ? { apiBaseUrl } : {}),
    timeoutMs
  };
}
