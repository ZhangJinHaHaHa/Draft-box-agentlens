import { describe, expect, it, vi } from "vitest";

import type { NeedParserTaxonomy } from "@/domain/needParser";

import { parseNeedWithLlm } from "./needParserClient";

const taxonomy: NeedParserTaxonomy = {
  scenarioIds: ["customer-support", "knowledge-qa", "workflow-automation"],
  tags: ["support", "rag"],
  accessTypes: ["api", "saas", "local"],
  riskLevels: ["low", "medium", "high"],
  complexities: ["low", "medium", "high"]
};

describe("parseNeedWithLlm", () => {
  it("falls back to local explicit keyword parsing when the platform parser times out", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => undefined);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const promise = parseNeedWithLlm({
      query: "我需要一个客服 agent，能接 API，低风险",
      locale: "zh",
      taxonomy,
      apiBaseUrl: "https://platform.example",
      timeoutMs: 50,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;
    vi.useRealTimers();

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://platform.example/api/llm/parse-need",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
    expect(result).toEqual({
      ok: true,
      result: expect.objectContaining({
        scenarioIds: ["customer-support"],
        accessTypes: ["api"],
        riskLevels: ["low"]
      })
    });
  });

  it("sends an abort signal to the platform parser request", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        ok: true,
        result: {
          scenarioIds: ["customer-support"],
          tags: [],
          accessTypes: ["api"],
          riskLevels: ["low"],
          complexities: [],
          hasAudit: false,
          hasOnboarding: false,
          confidence: 0.9,
          unmatchedTerms: []
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    ));

    const result = await parseNeedWithLlm({
      query: "客服 API 低风险",
      locale: "zh",
      taxonomy,
      apiBaseUrl: "https://platform.example",
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://platform.example/api/llm/parse-need",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });
});
