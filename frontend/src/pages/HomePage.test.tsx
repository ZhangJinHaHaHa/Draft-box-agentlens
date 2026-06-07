import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "@/config/appConfig";
import type { AgentCatalogEntry } from "@/domain/catalog";
import i18n from "@/i18n/config";
import { TooltipProvider } from "@/components/ui/tooltip";

import { HomePage } from "./HomePage";

const mocks = vi.hoisted(() => ({
  parseNeedWithLlm: vi.fn()
}));

const fixtureEntry: AgentCatalogEntry = {
  id: "fixture",
  source: "curated",
  name: "Fixture Agent",
  intro: { zh: "测试介绍", en: "Fixture intro" },
  category: "test",
  tags: ["coding", "ide"],
  scenarios: [
    { id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } },
    { id: "customer-support", label: { zh: "客服自动化", en: "Customer support automation" } },
    { id: "data-analysis", label: { zh: "数据分析", en: "Data analysis" } },
    { id: "developer-assistant", label: { zh: "研发助手", en: "Developer assistant" } },
    { id: "workflow-automation", label: { zh: "流程自动化", en: "Workflow automation" } },
    { id: "content-generation", label: { zh: "内容生成", en: "Content generation" } },
    { id: "market-research", label: { zh: "市场调研", en: "Market research" } }
  ],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["cli"],
  complexity: "low",
  hasOnboardingGuide: true
};

vi.mock("@/hooks/useCatalog", () => ({
  useCatalog: () => ({
    entries: [fixtureEntry],
    bySource: { curated: [], listed: [], native: [] },
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
  const state = location.state as { llmNeedParserUnavailable?: boolean } | null;
  const llmUnavailable = new URLSearchParams(location.search).get("llm") === "unavailable";
  return (
    <>
      <span data-testid="location">{`${location.pathname}${location.search}`}</span>
      {state?.llmNeedParserUnavailable || llmUnavailable ? <p>LLM 解析不可用，已回退到关键词搜索。</p> : null}
    </>
  );
}

function renderHome(): void {
  void i18n.changeLanguage("zh");
  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/zh"]}>
          <Routes>
            <Route
              path="/zh"
              element={
                <>
                  <HomePage config={config} />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/zh/agents" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </I18nextProvider>
  );
}

describe("HomePage LLM need parsing", () => {
  beforeEach(() => {
    mocks.parseNeedWithLlm.mockReset();
  });

  it("navigates with structured filters when the local LLM parser succeeds", async () => {
    mocks.parseNeedWithLlm.mockResolvedValue({
      ok: true,
      result: {
        scenarioIds: ["ide-coding"],
        tags: ["coding"],
        accessTypes: ["cli"],
        riskLevels: ["low"],
        complexities: [],
        hasAudit: false,
        hasOnboarding: true,
        confidence: 0.88,
        unmatchedTerms: []
      }
    });

    renderHome();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "帮团队做代码审查" }
    });
    fireEvent.submit(screen.getByRole("searchbox").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.parseNeedWithLlm).toHaveBeenCalledWith(
        expect.objectContaining({
          apiBaseUrl: "https://platform.example"
        })
      );
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/zh/agents?need=%E5%B8%AE%E5%9B%A2%E9%98%9F%E5%81%9A%E4%BB%A3%E7%A0%81%E5%AE%A1%E6%9F%A5&scenario=ide-coding&tag=coding&access=cli"
      );
    });
  });

  it("shows the parser error only when platform and local fallback both fail", async () => {
    mocks.parseNeedWithLlm.mockResolvedValue({ ok: false, error: "LLM need parser is unavailable." });

    renderHome();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "客服知识库自动回复" }
    });
    fireEvent.submit(screen.getByRole("searchbox").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("LLM 解析不可用，请配置本地 MiniMax 后重试。")).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent("/zh");
    });
  });

  it("only renders scenario tiles that match the current catalog", () => {
    renderHome();

    expect(screen.queryByText("DeFi 交易")).not.toBeInTheDocument();
    expect(screen.queryByText("DevOps & SRE")).not.toBeInTheDocument();

    expect(screen.getByText("客服自动化")).toBeInTheDocument();
    expect(screen.getByText("数据分析")).toBeInTheDocument();
    expect(screen.getByText("研发助手")).toBeInTheDocument();
    expect(screen.getByText("流程自动化")).toBeInTheDocument();
    expect(screen.getByText("内容生成")).toBeInTheDocument();
    expect(screen.getByText("市场调研")).toBeInTheDocument();
  });
});
