import { render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "@/config/appConfig";
import type { AgentCatalogEntry } from "@/domain/catalog";
import i18n from "@/i18n/config";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AgentListPage } from "./AgentListPage";

const mocks = vi.hoisted(() => ({
  parseNeedWithLlm: vi.fn()
}));

const v0Entry: AgentCatalogEntry = {
  id: "v0",
  source: "curated",
  name: "v0 by Vercel",
  intro: { zh: "生成前端 UI 和演示页面", en: "Generate frontend UI and demo pages" },
  category: "UI prototyping",
  tags: ["ui", "prototype", "nextjs"],
  scenarios: [{ id: "ui-prototyping", label: { zh: "UI 原型生成", en: "UI prototyping" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["saas"],
  complexity: "low",
  hasOnboardingGuide: true
};
const catalogEntries = [v0Entry];
const byId = new Map([[v0Entry.id, v0Entry]]);
const bySource = { curated: [v0Entry], listed: [], native: [] };

vi.mock("@/hooks/useCatalog", () => ({
  useCatalog: () => ({
    entries: catalogEntries,
    byId,
    bySource,
    nativeStatus: "idle",
    nativeError: null
  })
}));

vi.mock("@/lib/needParserClient", () => ({
  parseNeedWithLlm: mocks.parseNeedWithLlm
}));

const config: AppConfig = {
  rpcUrl: "http://127.0.0.1:18545",
  registryAddress: "0x0000000000000000000000000000000000000001",
  chainId: 302512,
  platformApiUrl: "https://platform.example"
};

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderAgentList(initialPath: string): void {
  void i18n.changeLanguage("zh");
  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="/zh/agents"
              element={
                <>
                  <AgentListPage config={config} />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </I18nextProvider>
  );
}

describe("AgentListPage semantic search fallback", () => {
  beforeEach(() => {
    mocks.parseNeedWithLlm.mockReset();
  });

  it("parses a zero-result keyword query into structured filters", async () => {
    mocks.parseNeedWithLlm.mockResolvedValue({
      ok: true,
      result: {
        scenarioIds: ["ui-prototyping"],
        tags: ["ui", "prototype"],
        accessTypes: [],
        riskLevels: [],
        complexities: [],
        hasAudit: false,
        hasOnboarding: false,
        confidence: 0.82,
        unmatchedTerms: ["ppt"]
      }
    });

    renderAgentList("/zh/agents?q=%E6%88%91%E8%A6%81%E5%81%9Appt");

    await waitFor(() => {
      expect(mocks.parseNeedWithLlm).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "我要做ppt",
          locale: "zh",
          apiBaseUrl: "https://platform.example"
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("v0 by Vercel")).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/zh/agents?need=%E6%88%91%E8%A6%81%E5%81%9Appt&scenario=ui-prototyping&tag=ui%2Cprototype"
      );
    });
  });
});
