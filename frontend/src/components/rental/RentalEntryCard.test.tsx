import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      <RentalEntryCard
        entry={entry}
        marketplaceConfigured={props.marketplaceConfigured ?? false}
        platformApiUrl={props.platformApiUrl}
        web2RentalUrl={props.web2RentalUrl}
      />
    </I18nextProvider>
  );
}

describe("RentalEntryCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows disabled Web2 and Web3 states when integrations are not configured", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: /Rental entry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create local rental/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /On-chain rental/i })).toBeDisabled();
    expect(screen.getByText(/Platform API is not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Wallet signing and on-chain grantRentalAccess are not connected yet/i)).toBeInTheDocument();
  });

  it("enables the Web2 application link when configured but keeps Web3 read-only", () => {
    renderCard({ web2RentalUrl: "https://orders.example.com/apply", marketplaceConfigured: true });

    expect(screen.getByRole("link", { name: /Open access form/i })).toHaveAttribute("href", "https://orders.example.com/apply");
    expect(screen.getByRole("button", { name: /On-chain rental/i })).toBeDisabled();
    expect(screen.getByText(/Marketplace pricing can be displayed; real wallet signing/i)).toBeInTheDocument();
  });

  it("creates a local Web2 rental through the Platform API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "https://platform.example/api/web2/google/mock") {
          expect(init?.method).toBe("POST");
          return new Response(
            JSON.stringify({
              user: {
                platformUserId: "web2-user-1",
                walletAddress: "0x1111111111111111111111111111111111111111",
                identityWeight: 10,
                custodyMode: "backend_custodied_exportable",
                identity: { provider: "google", email: "rental@agentlens.local" }
              },
              creditAccount: {
                userId: "web2-user-1",
                balance: 100,
                updatedAt: "2026-06-05T00:00:00.000Z"
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/orders") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            userId: "web2-user-1",
            agentId: "cursor",
            amount: "20.00",
            currency: "CREDITS"
          });
          return new Response(
            JSON.stringify({
              order: {
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "cursor",
                status: "pending",
                amount: "20.00",
                currency: "CREDITS",
                createdAt: "2026-06-05T00:00:00.000Z",
                updatedAt: "2026-06-05T00:00:00.000Z"
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/payments/mock-callback") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            orderId: "order-1",
            paymentProvider: "local-mock",
            paidAmount: "20.00"
          });
          return new Response(
            JSON.stringify({
              order: {
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "cursor",
                status: "gateway_lease_issued",
                amount: "20.00",
                currency: "CREDITS",
                createdAt: "2026-06-05T00:00:00.000Z",
                updatedAt: "2026-06-05T00:01:00.000Z",
                paidAt: "2026-06-05T00:01:00.000Z",
                paidAmount: "20.00",
                gatewayLeaseToken: "gateway-lease-1",
                gatewayLeaseIssuedAt: "2026-06-05T00:01:00.000Z",
                gatewayLeaseExpiresAt: "2026-07-05T00:01:00.000Z",
                chainGrantStatus: "pending_chain_grant"
              },
              bridge: {
                bridgeId: "access-bridge-1",
                orderId: "order-1",
                status: "pending_chain_grant",
                expectedGrantFunction: "grantRentalAccess",
                gatewayLeaseToken: "gateway-lease-1",
                gatewayLeaseIssuedAt: "2026-06-05T00:01:00.000Z",
                gatewayLeaseExpiresAt: "2026-07-05T00:01:00.000Z"
              },
              idempotentReplay: false
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    renderCard({ platformApiUrl: "https://platform.example" });
    fireEvent.click(screen.getByRole("button", { name: /Create local rental/i }));

    await waitFor(() => expect(screen.getByText(/Local rental created/i)).toBeInTheDocument());
    expect(screen.getByText("order-1")).toBeInTheDocument();
    expect(screen.getByText("gateway-lease-1")).toBeInTheDocument();
    expect(screen.getByText("access-bridge-1")).toBeInTheDocument();
    expect(screen.getByText(/real grantRentalAccess still needs the bridge/i)).toBeInTheDocument();
  });
});
