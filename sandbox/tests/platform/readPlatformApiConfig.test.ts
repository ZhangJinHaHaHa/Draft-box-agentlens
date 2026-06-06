import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { readPlatformApiConfig } from "../../src/platform/readPlatformApiConfig";

test("readPlatformApiConfig returns local defaults", () => {
  assert.deepEqual(readPlatformApiConfig({}), {
    host: "127.0.0.1",
    port: 8790,
    stateDir: join(process.cwd(), ".runtime", "platform-api"),
    recommendationCostCredits: 3,
    recommendationLlm: { provider: "mock" }
  });
});

test("readPlatformApiConfig reads persistence and LLM overrides", () => {
  assert.deepEqual(
    readPlatformApiConfig({
      PLATFORM_API_HOST: "0.0.0.0",
      PLATFORM_API_PORT: "9001",
      PLATFORM_API_STATE_DIR: "/tmp/agentlens-platform",
      PLATFORM_LLM_RECOMMENDATION_COST_CREDITS: "5",
      PLATFORM_RECOMMENDATION_LLM_PROVIDER: "openai",
      PLATFORM_RECOMMENDATION_LLM_API_KEY: "sk-test",
      PLATFORM_RECOMMENDATION_LLM_MODEL: "test-model",
      PLATFORM_RECOMMENDATION_LLM_API_BASE_URL: "https://llm.example/v1",
      PLATFORM_RECOMMENDATION_LLM_TIMEOUT_MS: "8000"
    }),
    {
      host: "0.0.0.0",
      port: 9001,
      stateDir: "/tmp/agentlens-platform",
      recommendationCostCredits: 5,
      recommendationLlm: {
        provider: "openai",
        apiKey: "sk-test",
        model: "test-model",
        apiBaseUrl: "https://llm.example/v1",
        timeoutMs: 8000
      }
    }
  );
});

test("readPlatformApiConfig defaults OpenAI recommendation timeout", () => {
  assert.equal(
    readPlatformApiConfig({
      PLATFORM_RECOMMENDATION_LLM_PROVIDER: "openai",
      PLATFORM_RECOMMENDATION_LLM_API_KEY: "sk-test",
      PLATFORM_RECOMMENDATION_LLM_MODEL: "test-model"
    }).recommendationLlm.timeoutMs,
    12_000
  );
});
