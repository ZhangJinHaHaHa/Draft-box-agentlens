import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "@/config/appConfig";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AgentCatalogEntry } from "@/domain/catalog";
import i18n from "@/i18n/config";

import { ComparePage } from "./ComparePage";

const cursorEntry: AgentCatalogEntry = {
  id: "cursor",
  source: "curated",
  name: "Cursor",
  intro: { zh: "AI IDE", en: "AI IDE" },
  category: "AI IDE",
  tags: ["coding"],
  scenarios: [{ id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["local", "saas"],
  complexity: "low",
  hasOnboardingGuide: true,
  officialUrl: "https://cursor.com",
  pricingHint: { zh: "订阅", en: "Subscription" },
  seller: {
    kind: "platform",
    label: { zh: "Cursor 团队", en: "Cursor team" },
    contextScale: { zh: "产品级 IDE 使用数据", en: "Product-scale IDE usage data" }
  }
};

const claudeCodeEntry: AgentCatalogEntry = {
  id: "claude-code",
  source: "curated",
  name: "Claude Code",
  intro: { zh: "终端编码 Agent", en: "Terminal coding agent" },
  category: "Coding agent",
  tags: ["coding"],
  scenarios: [{ id: "agentic-coding", label: { zh: "自主编程", en: "Agentic coding" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "medium",
  riskNotes: [],
  accessTypes: ["cli"],
  complexity: "medium",
  hasOnboardingGuide: true,
  officialUrl: "https://www.anthropic.com/claude-code",
  pricingHint: { zh: "Token 计费", en: "Token-based" },
  seller: {
    kind: "platform",
    label: { zh: "Anthropic", en: "Anthropic" },
    contextScale: { zh: "模型与终端编码工作流", en: "Model and terminal coding workflows" }
  }
};

const catalogEntries = [cursorEntry, claudeCodeEntry];
const byId = new Map(catalogEntries.map((entry) => [entry.id, entry]));

vi.mock("@/hooks/useCatalog", () => ({
  useCatalog: () => ({
    entries: catalogEntries,
    byId,
    bySource: { curated: catalogEntries, listed: [], native: [] },
    nativeStatus: "idle",
    nativeError: null
  })
}));

const config: AppConfig = {
  rpcUrl: "http://127.0.0.1:18545",
  registryAddress: "0x0000000000000000000000000000000000000001",
  chainId: 302512
};

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderComparePage(): void {
  sessionStorage.setItem("agentlens.compare.ids", "cursor,claude-code");
  void i18n.changeLanguage("zh");

  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/zh/compare?ids=cursor,claude-code"]}>
          <Routes>
            <Route
              path="/:locale/compare"
              element={
                <>
                  <ComparePage config={config} />
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

describe("ComparePage", () => {
  it("clears all selected agents from the compare page", () => {
    renderComparePage();

    expect(screen.getByRole("link", { name: "Cursor" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByText("背后卖家")).toBeInTheDocument();
    expect(screen.getByText("Cursor 团队")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空对比" }));

    expect(screen.getByText("请至少选择 2 个 Agent 进行对比")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/zh/compare");
    expect(sessionStorage.getItem("agentlens.compare.ids")).toBeNull();
  });
});
