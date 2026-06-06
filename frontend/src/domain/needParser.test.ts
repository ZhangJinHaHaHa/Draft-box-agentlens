import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "./catalog";
import {
  buildNeedParserTaxonomy,
  parseNeedParserResponse,
  toFiltersFromNeedParse
} from "./needParser";

const entry: AgentCatalogEntry = {
  id: "fixture",
  source: "curated",
  name: "Fixture Agent",
  intro: { zh: "测试介绍", en: "Fixture intro" },
  category: "test",
  tags: ["coding", "ide"],
  scenarios: [{ id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["cli"],
  complexity: "low",
  hasOnboardingGuide: true
};

describe("need parser taxonomy", () => {
  it("builds an allowlist from the current catalog", () => {
    expect(buildNeedParserTaxonomy([entry])).toMatchObject({
      scenarioIds: ["ide-coding"],
      tags: ["coding", "ide"],
      accessTypes: ["cli"]
    });
  });
});

describe("parseNeedParserResponse", () => {
  it("parses MiniMax JSON and drops values outside the taxonomy", () => {
    const taxonomy = buildNeedParserTaxonomy([entry]);

    const parsed = parseNeedParserResponse(
      JSON.stringify({
        scenarioIds: ["ide-coding", "unknown-scenario"],
        tags: ["coding", "unknown-tag"],
        accessTypes: ["cli", "unknown-access"],
        riskLevels: ["low", "impossible"],
        complexities: ["low", "impossible"],
        hasAudit: true,
        hasOnboarding: true,
        confidence: 0.83,
        unmatchedTerms: ["CRM"]
      }),
      taxonomy
    );

    expect(parsed).toEqual({
      scenarioIds: ["ide-coding"],
      tags: ["coding"],
      accessTypes: ["cli"],
      riskLevels: ["low"],
      complexities: ["low"],
      hasAudit: true,
      hasOnboarding: true,
      confidence: 0.83,
      unmatchedTerms: ["CRM"]
    });
  });

  it("normalizes low or invalid confidence without inventing matches", () => {
    const taxonomy = buildNeedParserTaxonomy([entry]);

    expect(
      parseNeedParserResponse(
        JSON.stringify({ scenarioIds: ["missing"], confidence: -1, hasAudit: false }),
        taxonomy
      )
    ).toMatchObject({
      scenarioIds: [],
      confidence: 0
    });
  });

  it("rejects non-JSON LLM output", () => {
    expect(() => parseNeedParserResponse("Here are the tags: coding", buildNeedParserTaxonomy([entry]))).toThrow(
      "LLM parse response must be JSON"
    );
  });
});

describe("toFiltersFromNeedParse", () => {
  it("uses scenario, tag and access as hard filters without using q", () => {
    const parsed = parseNeedParserResponse(
      JSON.stringify({
        scenarioIds: ["ide-coding"],
        tags: ["coding"],
        accessTypes: ["cli"],
        riskLevels: ["low"],
        complexities: ["low"],
        hasOnboarding: true,
        confidence: 0.9
      }),
      buildNeedParserTaxonomy([entry])
    );

    expect(toFiltersFromNeedParse(parsed, "帮我写代码")).toMatchObject({
      query: "",
      need: "帮我写代码",
      scenarios: ["ide-coding"],
      tags: ["coding"],
      accessTypes: ["cli"],
      riskLevels: [],
      complexities: [],
      hasOnboarding: false
    });
  });

  it("keeps quality filters only when the original need explicitly asks for them", () => {
    const parsed = parseNeedParserResponse(
      JSON.stringify({
        scenarioIds: ["ide-coding"],
        tags: ["coding"],
        accessTypes: ["cli"],
        riskLevels: ["low"],
        complexities: ["low"],
        hasAudit: true,
        hasOnboarding: true,
        confidence: 0.9
      }),
      buildNeedParserTaxonomy([entry])
    );

    expect(toFiltersFromNeedParse(parsed, "我要低风险、可验证审计、有上手指南、简单的代码 agent")).toMatchObject({
      riskLevels: ["low"],
      complexities: ["low"],
      hasAudit: true,
      hasOnboarding: true
    });
  });
});
