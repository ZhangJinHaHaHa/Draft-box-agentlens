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

const criminalDefenseEntry: AgentCatalogEntry = {
  id: "expert-criminal-defense",
  source: "marketplace",
  name: "无罪辩点·刑辩数字律师",
  intro: { zh: "刑辩专家 Agent", en: "Criminal defense expert agent" },
  category: "Legal expert agent",
  tags: ["legal"],
  scenarios: [{ id: "legal-defense", label: { zh: "刑事辩护", en: "Criminal defense" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "medium",
  riskNotes: [],
  accessTypes: ["saas"],
  complexity: "medium",
  hasOnboardingGuide: false,
  runtimeSecurity: {
    kind: "platform_image",
    label: { zh: "平台镜像已识别", en: "Platform image recognized" },
    description: { zh: "卖家已提交 Docker 镜像，平台可在云端受控运行。", en: "The seller submitted a Docker image, so the platform can run it in a controlled cloud runtime." },
    evidenceLabel: { zh: "镜像已识别", en: "Image recognized" }
  }
};

const insuranceClaimEntry: AgentCatalogEntry = {
  id: "expert-insurance-claim",
  source: "marketplace",
  name: "重疾拒赔申诉数字顾问",
  intro: { zh: "保险理赔专家 Agent", en: "Insurance claim expert agent" },
  category: "Legal expert agent",
  tags: ["insurance"],
  scenarios: [{ id: "insurance-claim", label: { zh: "保险理赔", en: "Insurance claims" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "medium",
  riskNotes: [],
  accessTypes: ["saas"],
  complexity: "medium",
  hasOnboardingGuide: false,
  runtimeSecurity: {
    kind: "seller_hosted",
    label: { zh: "未识别镜像", en: "Image not recognized" },
    description: { zh: "平台未识别到 Docker 镜像，买家输入可能暴露给卖家运行环境。", en: "The platform has not recognized a Docker image, so buyer input may be exposed to the seller runtime." }
  }
};

const harveyEntry: AgentCatalogEntry = {
  id: "harvey",
  source: "listed",
  name: "Harvey",
  intro: { zh: "法律外部工具", en: "External legal tool" },
  category: "Legal expert agent",
  tags: ["legal"],
  scenarios: [{ id: "legal-defense", label: { zh: "刑事辩护", en: "Criminal defense" } }],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "medium",
  riskNotes: [],
  accessTypes: ["saas"],
  complexity: "medium",
  hasOnboardingGuide: false,
  officialUrl: "https://www.harvey.ai"
};

const catalogEntries = [cursorEntry, claudeCodeEntry, criminalDefenseEntry, insuranceClaimEntry, harveyEntry];
const byId = new Map(catalogEntries.map((entry) => [entry.id, entry]));

vi.mock("@/hooks/useCatalog", () => ({
  useCatalog: () => ({
    entries: catalogEntries,
    byId,
    bySource: {
      marketplace: [criminalDefenseEntry, insuranceClaimEntry],
      curated: [cursorEntry, claudeCodeEntry],
      listed: [harveyEntry],
      native: []
    },
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

function renderComparePage(ids = "cursor,claude-code"): void {
  sessionStorage.setItem("agentlens.compare.ids", ids);
  void i18n.changeLanguage("zh");

  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[`/zh/compare?ids=${ids}`]}>
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

  it("shows buyer-facing runtime security boundaries for image recognition", () => {
    renderComparePage("expert-criminal-defense,expert-insurance-claim,harvey");

    expect(screen.getByText("运行安全边界")).toBeInTheDocument();
    expect(screen.getByText("平台镜像已识别")).toBeInTheDocument();
    expect(screen.getByText("未识别镜像")).toBeInTheDocument();
    expect(screen.getByText("外部工具 / 不适用")).toBeInTheDocument();
    expect(screen.getAllByText(/买家输入可能暴露给卖家运行环境/).length).toBeGreaterThan(0);
    expect(screen.getByText(/平台镜像已识别不等于平台担保安全/)).toBeInTheDocument();
  });
});
