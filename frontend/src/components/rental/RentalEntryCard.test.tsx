import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import type { AgentCatalogEntry } from "@/domain/catalog";
import i18n from "@/i18n/config";
import { RentalEntryCard } from "./RentalEntryCard";

const entry: AgentCatalogEntry = {
  id: "cursor",
  source: "curated",
  name: "Cursor",
  intro: { zh: "介绍", en: "Intro" },
  category: "coding",
  tags: [],
  scenarios: [],
  unsuitableScenarios: [],
  recommendedFor: [],
  riskLevel: "low",
  riskNotes: [],
  accessTypes: ["saas"],
  complexity: "low",
  hasOnboardingGuide: true
};

function renderCard(props: Partial<React.ComponentProps<typeof RentalEntryCard>> = {}): void {
  void i18n.changeLanguage("en");
  render(
    <I18nextProvider i18n={i18n}>
      <RentalEntryCard entry={entry} web2RentalUrl={props.web2RentalUrl} marketplaceConfigured={props.marketplaceConfigured ?? false} />
    </I18nextProvider>
  );
}

describe("RentalEntryCard", () => {
  it("shows disabled Web2 and Web3 states when integrations are not configured", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: /Rental entry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply access/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /On-chain rental/i })).toBeDisabled();
    expect(screen.getByText(/Order endpoint is not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Wallet transaction entry is not connected/i)).toBeInTheDocument();
  });

  it("enables the Web2 application link when configured but keeps Web3 read-only", () => {
    renderCard({ web2RentalUrl: "https://orders.example.com/apply", marketplaceConfigured: true });

    expect(screen.getByRole("link", { name: /Apply access/i })).toHaveAttribute("href", "https://orders.example.com/apply");
    expect(screen.getByRole("button", { name: /On-chain rental/i })).toBeDisabled();
    expect(screen.getByText(/Marketplace pricing can be displayed, but wallet signing is not implemented/i)).toBeInTheDocument();
  });
});
