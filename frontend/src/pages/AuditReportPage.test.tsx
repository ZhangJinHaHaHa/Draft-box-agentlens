import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "@/config/appConfig";
import i18n from "@/i18n/config";
import type { AgentAuditRegistryReadContract, AuditRecord } from "@/lib/agentAuditRegistryClient";
import type { AuditReportClient } from "@/lib/auditReportClient";
import { AuditReportPage } from "./AuditReportPage";

const config: AppConfig = {
  rpcUrl: "http://127.0.0.1:18545",
  registryAddress: "0x0000000000000000000000000000000000000001",
  chainId: 302512
};

const auditRecord: AuditRecord = {
  auditId: 1n,
  timestamp: 1_700_000_000n,
  auditScore: 72n,
  memoryPeakMb: 128n,
  cpuAvgMilli: 42n,
  requestIpCount: 1n,
  status: 1n,
  manifestHash: "0xmanifest",
  reportHash: "0xreport",
  reportCID: "bafy-report",
  manifestUrl: "https://example.com/manifest.json",
  attestationHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  appealRequested: false,
  appealApproved: false
};

function renderPage(reportClient: AuditReportClient): void {
  void i18n.changeLanguage("en");
  const client: AgentAuditRegistryReadContract = {
    getAgentProfile: vi.fn(),
    getLatestAuditReport: vi.fn(),
    getAuditCount: vi.fn().mockResolvedValue(1n),
    getAuditReportByIndex: vi.fn().mockResolvedValue(auditRecord)
  };

  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/en/agent/1/audits/latest/0"]}>
        <Routes>
          <Route
            path="/:locale/agent/:id/audits/:auditId/:auditIndex"
            element={<AuditReportPage config={config} client={client} reportClient={reportClient} />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("AuditReportPage", () => {
  it("shows user summary first and keeps technical evidence collapsed when report is unavailable", async () => {
    renderPage({
      readReportByCid: vi.fn().mockResolvedValue({
        ok: false,
        errorCode: "REPORT_UNAVAILABLE",
        error: "No report CID."
      })
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /User summary/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/On-chain summary only/i)).toBeInTheDocument();

    const technical = screen.getByText("Technical evidence");
    expect(technical.closest("details")).not.toHaveAttribute("open");

    fireEvent.click(technical);

    expect(screen.getByText(/No report CID/i)).toBeInTheDocument();
  });
});
