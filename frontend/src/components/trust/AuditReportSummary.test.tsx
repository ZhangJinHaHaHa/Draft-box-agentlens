import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import i18n from "@/i18n/config";
import type { AuditReportSummary as AuditReportSummaryData } from "@/domain/auditReportSummary";
import { AuditReportSummary } from "./AuditReportSummary";

function renderSummary(summary: AuditReportSummaryData): void {
  void i18n.changeLanguage("en");
  render(
    <I18nextProvider i18n={i18n}>
      <AuditReportSummary summary={summary} />
    </I18nextProvider>
  );
}

describe("AuditReportSummary", () => {
  it("renders the verified user summary without exposing raw JSON first", () => {
    renderSummary({
      verdict: "passed",
      severity: "success",
      score: 88,
      hashStatus: "verified",
      primaryRisk: { zh: "无重大风险", en: "No major risk found." },
      safetyBoundary: { zh: "边界完整", en: "Security boundary passed." },
      nextStep: { zh: "小范围试用", en: "Start with a limited trial." },
      badges: ["hash-verified", "tee-present"]
    });

    expect(screen.getByRole("heading", { name: /User summary/i })).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText(/No major risk found/i)).toBeInTheDocument();
    expect(screen.getByText(/Start with a limited trial/i)).toBeInTheDocument();
  });

  it("renders hash mismatch as a dangerous user-facing summary state", () => {
    renderSummary({
      verdict: "passed",
      severity: "danger",
      score: 88,
      hashStatus: "mismatch",
      primaryRisk: {
        zh: "报告哈希不一致",
        en: "Detailed report hash does not match the on-chain record."
      },
      safetyBoundary: { zh: "不能信任", en: "Do not rely on this report." },
      nextStep: { zh: "重新审计", en: "Request a new audit." },
      badges: ["hash-mismatch"]
    });

    expect(screen.getByText(/Report hash mismatch/i)).toBeInTheDocument();
    expect(screen.getByText(/Detailed report hash does not match/i)).toBeInTheDocument();
  });
});
