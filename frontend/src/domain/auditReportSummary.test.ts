import { describe, expect, it } from "vitest";

import type { AuditRecord } from "@/lib/agentAuditRegistryClient";
import type { DetailedAuditReport } from "@/lib/auditReportClient";
import { summarizeAuditReport } from "./auditReportSummary";

const auditRecord: AuditRecord = {
  auditId: 7,
  timestamp: 1_779_999_999,
  auditScore: 82,
  memoryPeakMb: 512,
  cpuAvgMilli: 240,
  requestIpCount: 2,
  status: 1,
  manifestHash: "0xmanifest",
  reportHash: "0xreport",
  reportCID: "bafy-report",
  manifestUrl: "https://example.com/manifest.json",
  attestationHash: "0xabc",
  appealRequested: false,
  appealApproved: false
};

const report: DetailedAuditReport = {
  schemaVersion: "audit-report.v2",
  agentName: "Sentinel",
  manifestHash: "0xmanifest",
  status: "completed",
  decisionType: "passed",
  healthcheckPassed: true,
  resourceMetrics: { cpuAvgMilli: 240, memoryPeakMb: 512 },
  networkActivity: {
    requestedIps: ["203.0.113.10"],
    requestedHosts: ["api.example.com"],
    requestCount: 1
  },
  securityBoundaryScore: {
    score: 74,
    hasAuthBoundary: true,
    privilegeEscalationResistant: true,
    flags: []
  },
  dimensionalScores: {
    overallScore: 82,
    dimensions: {
      security: 80,
      task_execution: 84,
      cognitive: 79,
      environment: 77,
      engineering: 83,
      compliance: 85
    }
  },
  responseTrace: { answer: "safe result", actions: [] },
  timestamps: {
    startedAt: "2026-03-30T09:00:00.000Z",
    finishedAt: "2026-03-30T09:00:01.000Z"
  }
};

describe("summarizeAuditReport", () => {
  it("summarizes a verified passed report for user-facing decision", () => {
    const summary = summarizeAuditReport({
      auditRecord,
      report,
      hashVerified: true
    });

    expect(summary.verdict).toBe("passed");
    expect(summary.score).toBe(82);
    expect(summary.hashStatus).toBe("verified");
    expect(summary.primaryRisk.en).toContain("No major");
    expect(summary.nextStep.en).toContain("limited");
  });

  it("keeps report unavailable distinct from hash mismatch", () => {
    const unavailable = summarizeAuditReport({
      auditRecord,
      report: null,
      hashVerified: false,
      reportUnavailableMessage: "Gateway is down"
    });

    const mismatch = summarizeAuditReport({
      auditRecord,
      report,
      hashVerified: false
    });

    expect(unavailable.hashStatus).toBe("unavailable");
    expect(mismatch.hashStatus).toBe("mismatch");
    expect(mismatch.severity).toBe("danger");
  });
});
