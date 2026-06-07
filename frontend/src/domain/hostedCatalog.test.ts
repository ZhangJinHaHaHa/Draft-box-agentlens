import { describe, expect, it } from "vitest";

import { getRuntimeSecurity, isRentable } from "./catalog";
import { mapHostedAgentsToCatalogEntries } from "./hostedCatalog";
import type { HostedAgentDraftPayload } from "@/lib/hostedAgentClient";

const approvedDraft: HostedAgentDraftPayload = {
  hostedAgentId: "hst-001",
  status: "approved",
  createdAt: "2026-06-06T10:00:00.000Z",
  updatedAt: "2026-06-06T10:04:00.000Z",
  developerAddress: "0x3333333333333333333333333333333333333333",
  readme: {
    agentName: "research-agent",
    displayName: "Research Agent",
    summary: "Summarizes market research requests.",
    useCases: ["market research", "investment summaries"],
    capabilities: ["summaries", "structured reports"],
    limitations: ["No investment advice."],
    example: "Input a research brief.",
    integrationType: "API",
    docsUrl: "https://docs.example.com"
  },
  integration: {
    endpointUrl: "https://api.example.com/agent",
    schemaUrl: "https://api.example.com/openapi.json",
    healthcheckUrl: "https://api.example.com/health",
    authMethod: "Platform-held API key"
  },
  review: {
    reviewKind: "hosted-api-black-box",
    submittedAt: "2026-06-06T10:02:00.000Z",
    fingerprint: {
      algorithm: "sha256",
      scope: "hosted-api",
      value: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2026-06-06T10:02:00.000Z",
      subject: {
        agentName: "research-agent",
        endpointHost: "api.example.com",
        schemaHost: "api.example.com",
        developerAddress: "0x3333333333333333333333333333333333333333"
      }
    },
    healthcheck: {
      status: "passed",
      checkedAt: "2026-06-06T10:02:00.000Z",
      httpStatus: 200,
      latencyMs: 35
    },
    notes: ["Healthcheck passed."]
  },
  approval: {
    approvedAt: "2026-06-06T10:04:00.000Z",
    reviewer: "local-admin"
  }
};

describe("hosted catalog mapping", () => {
  it("maps approved hosted Agents into rentable marketplace entries", () => {
    const [entry] = mapHostedAgentsToCatalogEntries([approvedDraft]);

    expect(entry?.id).toBe("hst-001");
    expect(entry?.source).toBe("marketplace");
    expect(entry?.name).toBe("Research Agent");
    expect(entry?.latestObservedAt).toBe("2026-06-06T10:04:00.000Z");
    expect(entry?.scenarios.map((item) => item.id)).toContain("market-research");
    expect(entry?.tags).toEqual(expect.arrayContaining(["hosted-api", "developer-listed", "rentable"]));
    expect(entry ? isRentable(entry) : false).toBe(true);
    expect(entry ? getRuntimeSecurity(entry).kind : undefined).toBe("seller_hosted");
  });

  it("does not expose draft or pending hosted Agents in the marketplace", () => {
    const drafts: HostedAgentDraftPayload[] = [
      { ...approvedDraft, hostedAgentId: "hst-draft", status: "draft" },
      { ...approvedDraft, hostedAgentId: "hst-pending", status: "pending_review" },
      { ...approvedDraft, hostedAgentId: "hst-suspended", status: "suspended" }
    ];

    expect(mapHostedAgentsToCatalogEntries(drafts)).toEqual([]);
  });

  it("marks hosted demo entries that represent the submitted image path", () => {
    const [entry] = mapHostedAgentsToCatalogEntries([
      {
        ...approvedDraft,
        readme: {
          ...approvedDraft.readme,
          agentName: "task-closure-platform-image",
          displayName: "Task Closure Platform Image Agent",
          useCases: ["任务闭环", "platform-image", "workflow automation"],
          capabilities: ["docker-image submitted", "rental review reputation"]
        }
      }
    ]);

    expect(entry?.category).toBe("Developer-listed platform image Agent");
    expect(entry?.tags).toEqual(expect.arrayContaining(["platform-image", "docker-image", "platform-hosted-demo"]));
    expect(entry ? getRuntimeSecurity(entry).kind : undefined).toBe("platform_image");
    expect(entry ? getRuntimeSecurity(entry).label.zh : undefined).toContain("已提交镜像");
  });
});
