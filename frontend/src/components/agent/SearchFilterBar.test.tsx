import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import i18n from "@/i18n/config";
import { EMPTY_FILTERS, type CatalogFacets, type CatalogFilters } from "@/domain/filters";

import { SearchFilterBar } from "./SearchFilterBar";

const facets: CatalogFacets = {
  scenarioIds: ["customer-support", "developer-assistant"],
  sources: ["curated", "listed"],
  accessTypes: ["api", "saas"],
  trustTiers: [1, 0],
  riskLevels: ["low", "medium"],
  complexities: ["low", "medium"],
  tags: ["ide", "open-source", "research", "coding", "search"],
  categories: [],
  priceModes: [],
  auditStatuses: [],
  scoreBands: [],
  toggles: {
    hasOnboarding: true,
    hasAudit: false,
    rentable: false
  }
};

function renderSearchFilterBar(filters: CatalogFilters = EMPTY_FILTERS): ReturnType<typeof vi.fn> {
  const onChange = vi.fn();
  void i18n.changeLanguage("zh");
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/zh/agents"]}>
        <Routes>
          <Route
            path="/:locale/agents"
            element={<SearchFilterBar filters={filters} facets={facets} onChange={onChange} resultCount={0} />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
  return onChange;
}

describe("SearchFilterBar", () => {
  it("keeps the detailed filter panel collapsed by default even when filters are active", () => {
    renderSearchFilterBar({ ...EMPTY_FILTERS, scenarios: ["devops-sre"] });

    expect(screen.getByText("已启用")).toBeInTheDocument();
    expect(screen.getByText("服务器运维")).toBeInTheDocument();
    expect(screen.queryByLabelText("DeFi 交易")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "筛选" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByLabelText("DeFi 交易")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("服务器运维")).not.toBeInTheDocument();
    expect(screen.getByLabelText("客服自动化")).toBeInTheDocument();
  });
});
