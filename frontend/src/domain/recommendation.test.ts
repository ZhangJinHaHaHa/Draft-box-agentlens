import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry, AccessType, Complexity, RiskLevel } from "./catalog";
import { recommendAgents, type RecommendationInput } from "./recommendation";

function entry({
  id,
  name,
  tags,
  scenarios,
  accessTypes = ["saas"],
  complexity = "medium",
  riskLevel = "medium",
  hasOnboardingGuide = true
}: {
  id: string;
  name: string;
  tags: string[];
  scenarios: string[];
  accessTypes?: AccessType[];
  complexity?: Complexity;
  riskLevel?: RiskLevel;
  hasOnboardingGuide?: boolean;
}): AgentCatalogEntry {
  return {
    id,
    source: "curated",
    name,
    intro: { zh: `${name} 简介`, en: `${name} intro` },
    category: "test",
    tags,
    scenarios: scenarios.map((scenario) => ({
      id: scenario,
      label: { zh: scenario, en: scenario }
    })),
    unsuitableScenarios: [],
    recommendedFor: [{ zh: tags.join(" "), en: tags.join(" ") }],
    riskLevel,
    riskNotes: [{ zh: `${name} 风险`, en: `${name} risk` }],
    accessTypes,
    complexity,
    hasOnboardingGuide
  };
}

const catalog = [
  entry({
    id: "cursor",
    name: "Cursor",
    tags: ["coding", "ide", "developer"],
    scenarios: ["developer-assistant", "ide-coding"],
    accessTypes: ["saas"],
    complexity: "low",
    riskLevel: "low"
  }),
  entry({
    id: "intercom-fin",
    name: "Fin",
    tags: ["customer", "support", "helpdesk"],
    scenarios: ["customer-support"],
    accessTypes: ["saas"],
    complexity: "medium",
    riskLevel: "medium"
  }),
  entry({
    id: "alva",
    name: "Alva",
    tags: ["market", "research", "investment"],
    scenarios: ["market-research"],
    accessTypes: ["saas"],
    complexity: "medium",
    riskLevel: "medium"
  }),
  entry({
    id: "zapier",
    name: "Zapier",
    tags: ["workflow", "automation", "integration"],
    scenarios: ["workflow-automation"],
    accessTypes: ["saas"],
    complexity: "low",
    riskLevel: "low"
  }),
  entry({
    id: "elevenlabs",
    name: "ElevenLabs",
    tags: ["voice", "audio", "generation"],
    scenarios: ["content-generation"],
    accessTypes: ["api", "saas"],
    complexity: "low",
    riskLevel: "medium"
  })
];

describe("recommendAgents", () => {
  it.each([
    ["coding assistant", "cursor", { task: "I need an IDE coding assistant", scenarioId: "developer-assistant", preferredAccessType: "saas" }],
    ["customer support", "intercom-fin", { task: "automate customer support tickets", scenarioId: "customer-support", preferredAccessType: "saas" }],
    ["market research", "alva", { task: "research crypto market narratives", scenarioId: "market-research", preferredAccessType: "saas" }],
    ["workflow automation", "zapier", { task: "connect forms to CRM workflow automation", scenarioId: "workflow-automation", preferredAccessType: "saas" }],
    ["voice generation", "elevenlabs", { task: "generate realistic voice audio", scenarioId: "content-generation", preferredAccessType: "api" }]
  ] as const)("ranks the expected candidate first for %s", (_label, expectedId, partialInput) => {
    const input: RecommendationInput = {
      usageContext: "solo",
      priority: "ease",
      acceptsNative: false,
      ...partialInput
    };

    const results = recommendAgents(catalog, input);

    expect(results[0]?.entry.id).toBe(expectedId);
    expect(results[0]?.reasonCodes.length).toBeGreaterThan(0);
    expect(results[0]?.riskWarnings.length).toBeGreaterThan(0);
    expect(results[0]?.nextStep.en).not.toHaveLength(0);
  });
});
