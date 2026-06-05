import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import i18n from "@/i18n/config";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AgentCatalogEntry, AgentSource } from "@/domain/catalog";

import { AgentCard } from "./AgentCard";

function makeEntry(source: AgentSource, id: string, name: string): AgentCatalogEntry {
  return {
    id,
    source,
    name,
    intro: { zh: `中文介绍 ${name}`, en: `English intro ${name}` },
    category: "test",
    tags: [],
    scenarios: [
      { id: "ide-coding", label: { zh: "IDE 内编程", en: "In-IDE coding" } }
    ],
    unsuitableScenarios: [],
    recommendedFor: [],
    riskLevel: "low",
    riskNotes: [],
    accessTypes: ["api"],
    complexity: "low",
    hasOnboardingGuide: source === "curated",
    chainEvidence:
      source === "native"
        ? { auditPassed: true, reportHash: "0xabc", attestationHash: "0xdef" }
        : undefined,
    tokenId: source === "native" ? id : undefined
  };
}

function renderInLocale(entry: AgentCatalogEntry, locale: "zh" | "en"): void {
  void i18n.changeLanguage(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[`/${locale}/agents`]}>
          <Routes>
            <Route path="/:locale/agents" element={<AgentCard entry={entry} />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </I18nextProvider>
  );
}

describe("AgentCard", () => {
  it.each([
    ["curated", "重点维护", "Curated"],
    ["listed", "已收录", "Listed"],
    ["native", "平台原生", "Platform native"]
  ] as const)("renders %s entries with intro + chips in zh and en", (source, zhLabel, enLabel) => {
    const entry = makeEntry(source, source, `${source}-agent`);

    renderInLocale(entry, "zh");
    expect(screen.getByRole("heading", { name: `${source}-agent` })).toBeInTheDocument();
    expect(screen.getByText(`中文介绍 ${source}-agent`)).toBeInTheDocument();
    expect(screen.getByText(zhLabel)).toBeInTheDocument();

    document.body.innerHTML = "";

    renderInLocale(entry, "en");
    expect(screen.getByRole("heading", { name: `${source}-agent` })).toBeInTheDocument();
    expect(screen.getByText(`English intro ${source}-agent`)).toBeInTheDocument();
    expect(screen.getByText(enLabel)).toBeInTheDocument();
  });
});
