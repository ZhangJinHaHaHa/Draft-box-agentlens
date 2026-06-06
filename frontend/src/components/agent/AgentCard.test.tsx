import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

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

async function renderInLocale(entry: AgentCatalogEntry, locale: "zh" | "en"): Promise<void> {
  await i18n.changeLanguage(locale);
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

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderWithLocation(entry: AgentCatalogEntry): void {
  void i18n.changeLanguage("en");
  render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/en/agents"]}>
          <Routes>
            <Route
              path="/:locale/agents"
              element={
                <>
                  <AgentCard entry={entry} />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/:locale/agent/:id" element={<p>detail page</p>} />
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
  ] as const)("renders %s entries with intro + chips in zh and en", async (source, zhLabel, enLabel) => {
    const entry = makeEntry(source, source, `${source}-agent`);

    await renderInLocale(entry, "zh");
    expect(screen.getByRole("heading", { name: `${source}-agent` })).toBeInTheDocument();
    expect(screen.getByText(`中文介绍 ${source}-agent`)).toBeInTheDocument();
    expect(screen.getByText(zhLabel)).toBeInTheDocument();

    cleanup();

    await renderInLocale(entry, "en");
    expect(screen.getByRole("heading", { name: `${source}-agent` })).toBeInTheDocument();
    expect(screen.getByText(`English intro ${source}-agent`)).toBeInTheDocument();
    expect(screen.getByText(enLabel)).toBeInTheDocument();
  });

  it("adds an agent to compare without navigating the card link", () => {
    const entry = makeEntry("curated", "cursor", "Cursor");

    renderWithLocation(entry);
    fireEvent.click(screen.getByRole("button", { name: /add to compare/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/en/agents?ids=cursor");
    expect(screen.queryByText("detail page")).not.toBeInTheDocument();
  });

  it("renders seller provenance for marketplace entries", async () => {
    const entry = {
      ...makeEntry("marketplace", "expert", "Expert Agent"),
      seller: {
        kind: "solo" as const,
        label: { zh: "刑辩律师", en: "Criminal-defense lawyer" },
        contextScale: { zh: "真实案卷库", en: "Real case-file library" }
      }
    };

    await renderInLocale(entry, "en");

    expect(screen.getByText(/Seller:/)).toBeInTheDocument();
    expect(screen.getByText(/Criminal-defense lawyer/)).toBeInTheDocument();
    expect(screen.getByText(/Real case-file library/)).toBeInTheDocument();
  });
});
