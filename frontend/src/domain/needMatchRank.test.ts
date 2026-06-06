import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import { EMPTY_FILTERS } from "./filters";
import { rankEntriesForNeed } from "./needMatchRank";

function entry(overrides: Partial<AgentCatalogEntry>): AgentCatalogEntry {
  return {
    id: "base",
    source: "listed",
    name: "Base Agent",
    intro: { zh: "基础介绍", en: "Base intro" },
    category: "test",
    tags: [],
    scenarios: [],
    unsuitableScenarios: [],
    recommendedFor: [],
    riskLevel: "low",
    riskNotes: [],
    accessTypes: ["saas"],
    complexity: "low",
    hasOnboardingGuide: false,
    ...overrides
  };
}

describe("rankEntriesForNeed", () => {
  it("ranks specialist matches ahead of broad generic assistants", () => {
    const generic = entry({
      id: "chatgpt",
      name: "ChatGPT",
      tags: ["llm", "general", "knowledge"],
      scenarios: [
        { id: "knowledge-qa", label: { zh: "知识库问答", en: "Knowledge QA" } },
        { id: "content-generation", label: { zh: "内容生成", en: "Content generation" } }
      ]
    });
    const specialist = entry({
      id: "intercom-fin",
      name: "Intercom Fin",
      tags: ["support", "intercom", "knowledge"],
      scenarios: [
        { id: "customer-support", label: { zh: "客服自动化", en: "Customer support" } },
        { id: "knowledge-qa", label: { zh: "知识库问答", en: "Knowledge QA" } }
      ]
    });
    const automation = entry({
      id: "zapier",
      name: "Zapier Agents",
      tags: ["automation", "zapier"],
      scenarios: [
        { id: "workflow-automation", label: { zh: "流程自动化", en: "Workflow automation" } },
        { id: "customer-support", label: { zh: "客服自动化", en: "Customer support" } }
      ]
    });

    const ranked = rankEntriesForNeed([generic, automation, specialist], {
      ...EMPTY_FILTERS,
      need: "客服知识库自动回复",
      scenarios: ["customer-support", "knowledge-qa"],
      tags: ["support", "knowledge", "automation", "llm"]
    });

    expect(ranked[0].id).toBe("intercom-fin");
    expect(ranked.findIndex((item) => item.id === "intercom-fin")).toBeLessThan(
      ranked.findIndex((item) => item.id === "chatgpt")
    );
  });

  it("preserves catalog order when no LLM need is present", () => {
    const first = entry({ id: "first" });
    const second = entry({ id: "second" });

    expect(rankEntriesForNeed([first, second], EMPTY_FILTERS)).toEqual([first, second]);
  });

  it("does not let broad multimodal assistants outrank a specialist tag match", () => {
    const generic = entry({
      id: "chatgpt",
      name: "ChatGPT",
      tags: ["llm", "general", "multimodal"],
      scenarios: [
        { id: "content-generation", label: { zh: "内容生成", en: "Content generation" } },
        { id: "multimodal-chat", label: { zh: "多模态对话", en: "Multimodal chat" } }
      ]
    });
    const specialist = entry({
      id: "elevenlabs",
      name: "ElevenLabs",
      tags: ["voice", "tts", "multilingual"],
      scenarios: [{ id: "content-generation", label: { zh: "内容生成", en: "Content generation" } }]
    });

    const ranked = rankEntriesForNeed([generic, specialist], {
      ...EMPTY_FILTERS,
      need: "语音配音生成",
      scenarios: ["content-generation", "multimodal-chat"],
      tags: ["voice", "tts", "multimodal"]
    });

    expect(ranked[0].id).toBe("elevenlabs");
  });
});
