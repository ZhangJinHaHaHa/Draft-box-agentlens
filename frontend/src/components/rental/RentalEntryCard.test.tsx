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
        entry={props.entry ?? entry}
        hostedAgentApiUrl={props.hostedAgentApiUrl}
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
    expect(screen.getByRole("heading", { name: /Rental entry/i }).closest("#rental-lifecycle")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Create local rental/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /On-chain rental/i })).toBeDisabled();
    expect(screen.getByText(/Platform API is not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/On-chain grants for Web2\/fiat orders still wait for the grantRentalAccess bridge/i)).toBeInTheDocument();
    expect(screen.getByText(/Review area \(rental users only\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unlock after rental/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rent before reviewing/i })).toBeDisabled();
    expect(screen.getByText(/Creating a rental produces the first reputation snapshot/i)).toBeInTheDocument();
  });

  it("enables the Web2 application link when configured but keeps Web3 read-only", () => {
    renderCard({ web2RentalUrl: "https://orders.example.com/apply", marketplaceConfigured: true });

    expect(screen.getByRole("link", { name: /Open access form/i })).toHaveAttribute("href", "https://orders.example.com/apply");
    expect(screen.getByRole("button", { name: /On-chain rental/i })).toBeDisabled();
    expect(screen.getByText(/Marketplace pricing can be displayed; on-chain grants for Web2\/fiat orders/i)).toBeInTheDocument();
  });

  it("creates a local Web2 rental and runs MVP-3 lifecycle actions through the Platform API", async () => {
    let reviewSubmitted = false;
    let refundResolved = false;
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
        if (url === "https://platform.example/api/developers") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            displayName: "Cursor Demo Provider",
            walletAddress: "0x3333333333333333333333333333333333333333",
            trustStatus: "verified",
            trustScore: 82
          });
          return new Response(
            JSON.stringify({
              developer: {
                developerId: "developer-1",
                displayName: "Cursor Demo Provider",
                walletAddress: "0x3333333333333333333333333333333333333333",
                trustStatus: "verified",
                trustScore: 82,
                createdAt: "2026-06-05T00:00:00.000Z",
                updatedAt: "2026-06-05T00:00:00.000Z"
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/developers/developer-1/agents") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({ agentId: "cursor" });
          return new Response(
            JSON.stringify({
              link: {
                agentId: "cursor",
                developerId: "developer-1",
                linkedAt: "2026-06-05T00:00:00.000Z"
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
        if (url === "https://platform.example/api/settlements/orders/order-1") {
          return new Response(
            JSON.stringify({
              settlement: {
                settlementId: "settlement-1",
                orderId: "order-1",
                agentId: "cursor",
                developerId: "developer-1",
                grossAmount: "20.00",
                currency: "CREDITS",
                platformFeeAmount: "4.00",
                developerShareAmount: "16.00",
                holdbackAmount: "1.60",
                payableAmount: "14.40",
                status: refundResolved ? "refunded" : "pending_holdback",
                updatedAt: "2026-06-05T00:01:00.000Z"
              }
            }),
            { status: 200 }
          );
        }
        if (url === "https://platform.example/api/reputation/agents/cursor") {
          return new Response(
            JSON.stringify({
              reputation: {
                subjectType: "agent",
                subjectId: "cursor",
                score: reviewSubmitted ? 99 : refundResolved ? 83 : 91,
                tier: "high",
                source: "local-farr-adapter",
                updatedAt: "2026-06-05T00:02:00.000Z",
                signals: {
                  paidOrders: 1,
                  gatewayLeasesIssued: 1,
                  pendingChainGrants: 1,
                  refunds: refundResolved ? 1 : 0,
                  severeRefunds: 0,
                  reviewCount: reviewSubmitted ? 1 : 0,
                  averageRating: reviewSubmitted ? 5 : null,
                  platformRating: reviewSubmitted ? 100 : null,
                  capabilityMismatchReports: 0,
                  safetyIncidentReports: 0,
                  developerTrustScore: 82
                }
              }
            }),
            { status: 200 }
          );
        }
        if (url === "https://platform.example/api/reviews") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            orderId: "order-1",
            userId: "web2-user-1",
            overallRating: 5,
            capabilityMatched: true,
            safetyIncidentReported: false
          });
          reviewSubmitted = true;
          return new Response(
            JSON.stringify({
              review: {
                reviewId: "usage-review-1",
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "cursor",
                overallRating: 5,
                dimensionRatings: {
                  security: 2,
                  taskExecution: 2,
                  cognitive: 2,
                  environment: 1,
                  engineering: 2,
                  compliance: 2
                },
                capabilityMatched: true,
                safetyIncidentReported: false,
                commentText: "Local MVP-3 demo review: Gateway lease delivered and capability matched.",
                commentHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
                createdAt: "2026-06-05T00:02:00.000Z"
              },
              summary: {
                agentId: "cursor",
                reviewCount: 1,
                averageRating: 5,
                platformRating: 100,
                capabilityMismatchReports: 0,
                safetyIncidentReports: 0
              },
              reputation: {
                subjectType: "agent",
                subjectId: "cursor",
                score: 99,
                tier: "high",
                source: "local-farr-adapter",
                updatedAt: "2026-06-05T00:02:00.000Z",
                signals: {
                  paidOrders: 1,
                  gatewayLeasesIssued: 1,
                  pendingChainGrants: 1,
                  refunds: 0,
                  severeRefunds: 0,
                  reviewCount: 1,
                  averageRating: 5,
                  platformRating: 100,
                  capabilityMismatchReports: 0,
                  safetyIncidentReports: 0,
                  developerTrustScore: 82
                }
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/agent-chat") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            agentId: "cursor",
            orderId: "order-1",
            gatewayLeaseToken: "gateway-lease-1",
            locale: "en"
          });
          return new Response(
            JSON.stringify({
              agentId: "cursor",
              answer: "The rented Agent checked the request and returned a concrete next step.",
              engine: "openai",
              model: "gpt-5.5",
              safetyNotice: "This response is a demo invocation result."
            }),
            { status: 200 }
          );
        }
        if (url === "https://platform.example/api/refunds") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            orderId: "order-1",
            category: "core_capability_failure"
          });
          return new Response(
            JSON.stringify({
              refund: {
                refundId: "refund-1",
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "cursor",
                category: "core_capability_failure",
                status: "requested",
                eligibility: "review_required",
                requestedAt: "2026-06-05T00:03:00.000Z",
                updatedAt: "2026-06-05T00:03:00.000Z"
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/refunds/refund-1/review") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({ reviewerId: "ops-local-demo" });
          return new Response(
            JSON.stringify({
              refund: {
                refundId: "refund-1",
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "cursor",
                category: "core_capability_failure",
                status: "under_review",
                eligibility: "review_required",
                reviewerId: "ops-local-demo",
                requestedAt: "2026-06-05T00:03:00.000Z",
                updatedAt: "2026-06-05T00:04:00.000Z"
              }
            }),
            { status: 200 }
          );
        }
        if (url === "https://platform.example/api/refunds/refund-1/resolve") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            outcome: "partial_refund",
            refundAmount: "6.00"
          });
          refundResolved = true;
          return new Response(
            JSON.stringify({
              refund: {
                refundId: "refund-1",
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "cursor",
                category: "core_capability_failure",
                status: "partial_refund",
                eligibility: "review_required",
                reviewerId: "ops-local-demo",
                reviewNote: "Local demo operator approved a partial refund while preserving the rental record.",
                refundAmount: "6.00",
                requestedAt: "2026-06-05T00:03:00.000Z",
                resolvedAt: "2026-06-05T00:05:00.000Z",
                updatedAt: "2026-06-05T00:05:00.000Z"
              }
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
    expect(screen.getByText(/MVP-3 local lifecycle/i)).toBeInTheDocument();
    expect(screen.getByText("settlement-1")).toBeInTheDocument();
    expect(screen.getByText(/Platform 4.00 \/ developer 16.00 \/ holdback 1.60 CREDITS/i)).toBeInTheDocument();
    expect(screen.getAllByText("91 / high")).toHaveLength(2);
    expect(screen.getByText(/Review enabled/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit usage review/i })).toBeEnabled();
    expect(screen.getByText(/Generated after review submission/i)).toBeInTheDocument();
    expect(screen.getByText(/Expert Agent workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Gateway lease verified/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sample question/i }));
    fireEvent.click(screen.getByRole("button", { name: /Invoke Agent/i }));
    await waitFor(() => expect(screen.getByText(/concrete next step/i)).toBeInTheDocument());
    expect(screen.getByText(/demo invocation result/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Submit usage review/i }));
    await waitFor(() => expect(screen.getByText(/usage-review-1 \/ rating 100/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Review submitted/i })).toBeDisabled();
    expect(screen.getAllByText("99 / high")).toHaveLength(2);
    expect(screen.getByText(/Reviewed/i)).toBeInTheDocument();
    expect(screen.getByText("Local MVP-3 demo review: Gateway lease delivered and capability matched.")).toBeInTheDocument();
    expect(screen.getByText("0x1111111111111111111111111111111111111111111111111111111111111111")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Task execution")).toBeInTheDocument();
    expect(screen.getAllByText(/2\/2 · Good/i)).toHaveLength(5);
    expect(screen.getByText(/1\/2 · Neutral/i)).toBeInTheDocument();
    expect(screen.getByText(/^Reviews$/i)).toBeInTheDocument();
    expect(screen.getByText("2026-06-05T00:02:00.000Z")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Run refund review/i }));
    await waitFor(() => expect(screen.getByText(/refund-1 \/ partial_refund \/ 6.00/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Refund reviewed/i })).toBeDisabled();
    expect(screen.getByText("refunded")).toBeInTheDocument();
  });

  it("creates a hosted Gateway lease for approved hosted marketplace agents", async () => {
    const hostedEntry: AgentCatalogEntry = {
      ...entry,
      id: "hst-001",
      source: "marketplace",
      name: "Hosted Research Agent",
      tags: ["hosted-api", "developer-listed", "rentable"],
      nativePricing: { rentable: true }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "https://platform.example/api/web2/google/mock") {
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
        if (url === "https://platform.example/api/developers") {
          return new Response(
            JSON.stringify({
              developer: {
                developerId: "developer-1",
                displayName: "Hosted Research Agent Demo Provider",
                walletAddress: "0x3333333333333333333333333333333333333333",
                trustStatus: "verified",
                trustScore: 82,
                createdAt: "2026-06-05T00:00:00.000Z",
                updatedAt: "2026-06-05T00:00:00.000Z"
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/developers/developer-1/agents") {
          return new Response(
            JSON.stringify({
              link: {
                agentId: "hst-001",
                developerId: "developer-1",
                linkedAt: "2026-06-05T00:00:00.000Z"
              }
            }),
            { status: 201 }
          );
        }
        if (url === "https://platform.example/api/orders") {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            userId: "web2-user-1",
            agentId: "hst-001"
          });
          return new Response(
            JSON.stringify({
              order: {
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "hst-001",
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
          return new Response(
            JSON.stringify({
              order: {
                orderId: "order-1",
                userId: "web2-user-1",
                agentId: "hst-001",
                status: "gateway_lease_issued",
                amount: "20.00",
                currency: "CREDITS",
                createdAt: "2026-06-05T00:00:00.000Z",
                updatedAt: "2026-06-05T00:01:00.000Z",
                paidAt: "2026-06-05T00:01:00.000Z",
                paidAmount: "20.00",
                gatewayLeaseToken: "platform-gateway-lease-1",
                gatewayLeaseIssuedAt: "2026-06-05T00:01:00.000Z",
                gatewayLeaseExpiresAt: "2026-07-05T00:01:00.000Z",
                chainGrantStatus: "pending_chain_grant"
              },
              bridge: {
                bridgeId: "access-bridge-1",
                orderId: "order-1",
                status: "pending_chain_grant",
                expectedGrantFunction: "grantRentalAccess",
                gatewayLeaseToken: "platform-gateway-lease-1",
                gatewayLeaseIssuedAt: "2026-06-05T00:01:00.000Z",
                gatewayLeaseExpiresAt: "2026-07-05T00:01:00.000Z"
              },
              idempotentReplay: false
            }),
            { status: 200 }
          );
        }
        if (url === "https://hosted.example/api/hosted-agents/hst-001/leases") {
          expect(init?.method).toBe("POST");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            userId: "web2-user-1",
            durationHours: 24,
            maxRequests: 20,
            maxRequestsPerMinute: 5
          });
          return new Response(
            JSON.stringify({
              hostedAgentId: "hst-001",
              lease: {
                leaseId: "hosted-lease-1",
                hostedAgentId: "hst-001",
                userId: "web2-user-1",
                accessToken: "hosted-access-token-1",
                createdAt: "2026-06-05T00:01:10.000Z",
                expiresAt: "2026-06-06T00:01:10.000Z",
                maxRequests: 20,
                maxRequestsPerMinute: 5,
                requestCount: 0
              }
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        if (url === "https://platform.example/api/settlements/orders/order-1") {
          return new Response(
            JSON.stringify({
              settlement: {
                settlementId: "settlement-1",
                orderId: "order-1",
                agentId: "hst-001",
                developerId: "developer-1",
                grossAmount: "20.00",
                currency: "CREDITS",
                platformFeeAmount: "4.00",
                developerShareAmount: "16.00",
                holdbackAmount: "1.60",
                payableAmount: "14.40",
                status: "pending_holdback",
                updatedAt: "2026-06-05T00:01:00.000Z"
              }
            }),
            { status: 200 }
          );
        }
        if (url === "https://platform.example/api/reputation/agents/hst-001") {
          return new Response(
            JSON.stringify({
              reputation: {
                subjectType: "agent",
                subjectId: "hst-001",
                score: 91,
                tier: "high",
                source: "local-farr-adapter",
                updatedAt: "2026-06-05T00:02:00.000Z",
                signals: {
                  paidOrders: 1,
                  gatewayLeasesIssued: 1,
                  pendingChainGrants: 1,
                  refunds: 0,
                  severeRefunds: 0,
                  reviewCount: 0,
                  averageRating: null,
                  platformRating: null,
                  capabilityMismatchReports: 0,
                  safetyIncidentReports: 0,
                  developerTrustScore: 82
                }
              }
            }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      })
    );

    renderCard({
      entry: hostedEntry,
      platformApiUrl: "https://platform.example",
      hostedAgentApiUrl: "https://hosted.example/api/hosted-agents"
    });
    fireEvent.click(screen.getByRole("button", { name: /Create local rental/i }));

    await waitFor(() => expect(screen.getByText(/Local rental created/i)).toBeInTheDocument());
    expect(screen.getByText("platform-gateway-lease-1")).toBeInTheDocument();
    expect(screen.getByText("hosted-access-token-1")).toBeInTheDocument();
    expect(screen.getByText(/Hosted Agent Gateway unlocked/i)).toBeInTheDocument();
  });
});
