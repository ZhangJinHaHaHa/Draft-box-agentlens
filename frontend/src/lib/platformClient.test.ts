import { describe, expect, it } from "vitest";

import {
  createMockGoogleUser,
  createPlatformDeveloper,
  createPlatformRefund,
  createPlatformOrder,
  getAgentReputation,
  getAccessBridge,
  getPlatformAdminInspect,
  getPlatformCredits,
  getPlatformOrder,
  getPlatformSettlement,
  linkPlatformAgentDeveloper,
  invokePlatformAgent,
  migrateWallet,
  resolvePlatformRefund,
  requestWalletExport,
  requestPaidLlmRecommendation,
  startPlatformRefundReview,
  submitUsageReview,
  submitMockPaymentCallback
} from "./platformClient";

describe("platformClient", () => {
  it("creates a local Google-backed user and credit account", async () => {
    const response = await createMockGoogleUser(
      "https://platform.example/",
      { googleSubject: "google-1", email: "demo@example.com" },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/web2/google/mock");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            user: {
              platformUserId: "web2-user-1",
              walletAddress: "0x1111111111111111111111111111111111111111",
              identityWeight: 10,
              custodyMode: "backend_custodied_exportable",
              identity: { provider: "google", email: "demo@example.com" }
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
    );

    expect(response.user.platformUserId).toBe("web2-user-1");
    expect(response.creditAccount.balance).toBe(100);
  });

  it("requests a paid LLM recommendation and parses charging metadata", async () => {
    const response = await requestPaidLlmRecommendation(
      "https://platform.example",
      {
        userId: "web2-user-1",
        query: "自托管 RAG API",
        limit: 2
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/recommendations/llm");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            engine: "mock-llm",
            charged: true,
            fallbackUsed: false,
            costCredits: 3,
            creditAccount: {
              userId: "web2-user-1",
              balance: 97,
              updatedAt: "2026-06-05T00:01:00.000Z"
            },
            recommendation: {
              results: [
                {
                  agentId: "dify",
                  score: 88,
                  reasons: [{ zh: "匹配 RAG", en: "Matches RAG" }],
                  matchedScenarioIds: ["knowledge-qa"]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(response.engine).toBe("mock-llm");
    expect(response.charged).toBe(true);
    expect(response.creditAccount.balance).toBe(97);
    expect(response.recommendation.results[0].agentId).toBe("dify");
  });

  it("invokes a rented platform Agent through the Gateway lease", async () => {
    const response = await invokePlatformAgent(
      "https://platform.example",
      {
        agentId: "expert-criminal-defense",
        orderId: "order-1",
        gatewayLeaseToken: "gateway-lease-1",
        message: "请梳理辩点",
        locale: "zh"
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/agent-chat");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          agentId: "expert-criminal-defense",
          orderId: "order-1",
          gatewayLeaseToken: "gateway-lease-1",
          message: "请梳理辩点",
          locale: "zh"
        });
        return new Response(
          JSON.stringify({
            agentId: "expert-criminal-defense",
            answer: "可先核查证据链和程序瑕疵。",
            engine: "openai",
            model: "gpt-5.5",
            safetyNotice: "辅助分析，不构成正式法律意见。"
          }),
          { status: 200 }
        );
      }
    );

    expect(response.answer).toContain("证据链");
    expect(response.model).toBe("gpt-5.5");
  });

  it("times out a stuck paid LLM recommendation request", async () => {
    await expect(
      requestPaidLlmRecommendation(
        "https://platform.example",
        {
          userId: "web2-user-1",
          query: "自托管 RAG API",
          limit: 2
        },
        async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            expect(signal).toBeTruthy();
            signal?.addEventListener(
              "abort",
              () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true }
            );
          }),
        5
      )
    ).rejects.toThrow("timed out after 5ms");
  });

  it("reads platform credits", async () => {
    const account = await getPlatformCredits(
      "https://platform.example/",
      "web2-user-1",
      async (url) => {
        expect(url).toBe("https://platform.example/api/web2/users/web2-user-1/credits");
        return new Response(
          JSON.stringify({
            creditAccount: {
              userId: "web2-user-1",
              balance: 97,
              updatedAt: "2026-06-05T00:01:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(account.balance).toBe(97);
  });

  it("creates a local order and applies a mock payment callback", async () => {
    const order = await createPlatformOrder(
      "https://platform.example",
      {
        userId: "web2-user-1",
        agentId: "cursor",
        amount: "20.00",
        currency: "CREDITS"
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/orders");
        expect(init?.method).toBe("POST");
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
    );
    const payment = await submitMockPaymentCallback(
      "https://platform.example",
      {
        orderId: "order-1",
        paymentProvider: "local-mock",
        providerPaymentId: "local-payment-1",
        idempotencyKey: "local-rental:cursor:web2-user-1:1",
        paidAmount: "20.00"
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/payments/mock-callback");
        expect(init?.method).toBe("POST");
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
    );
    const lookup = await getPlatformOrder(
      "https://platform.example",
      "order-1",
      async (url) => {
        expect(url).toBe("https://platform.example/api/orders/order-1");
        return new Response(
          JSON.stringify({
            order: payment.order,
            accessBridge: payment.bridge
          }),
          { status: 200 }
        );
      }
    );

    expect(order.status).toBe("pending");
    expect(payment.order.status).toBe("gateway_lease_issued");
    expect(payment.order.chainGrantStatus).toBe("pending_chain_grant");
    expect(payment.bridge.expectedGrantFunction).toBe("grantRentalAccess");
    expect(lookup.accessBridge?.bridgeId).toBe("access-bridge-1");
  });

  it("runs local MVP-3 lifecycle helpers for settlement, reputation, review, and refund", async () => {
    const developer = await createPlatformDeveloper(
      "https://platform.example",
      {
        displayName: "Cursor Demo Provider",
        walletAddress: "0x3333333333333333333333333333333333333333",
        trustStatus: "verified",
        trustScore: 82
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/developers");
        expect(init?.method).toBe("POST");
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
    );
    const link = await linkPlatformAgentDeveloper(
      "https://platform.example",
      "developer-1",
      "cursor",
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/developers/developer-1/agents");
        expect(init?.method).toBe("POST");
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
    );
    const settlement = await getPlatformSettlement(
      "https://platform.example",
      "order-1",
      async (url) => {
        expect(url).toBe("https://platform.example/api/settlements/orders/order-1");
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
              status: "pending_holdback",
              updatedAt: "2026-06-05T00:01:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
    );
    const reputation = await getAgentReputation(
      "https://platform.example",
      "cursor",
      async (url) => {
        expect(url).toBe("https://platform.example/api/reputation/agents/cursor");
        return new Response(
          JSON.stringify({
            reputation: {
              subjectType: "agent",
              subjectId: "cursor",
              score: 91,
              tier: "high",
              source: "local-farr-adapter",
              updatedAt: "2026-06-05T00:01:00.000Z",
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
    );
    const review = await submitUsageReview(
      "https://platform.example",
      {
        orderId: "order-1",
        userId: "web2-user-1",
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
        commentText: "Matched the demo workflow."
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/reviews");
        expect(init?.method).toBe("POST");
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
              commentText: "Matched the demo workflow.",
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
    );
    const createdRefund = await createPlatformRefund(
      "https://platform.example",
      {
        orderId: "order-1",
        category: "core_capability_failure",
        expectedCapability: "Complete the promised workflow.",
        actualFailure: "Partial failure in demo evidence."
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/refunds");
        expect(init?.method).toBe("POST");
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
    );
    await startPlatformRefundReview(
      "https://platform.example",
      "refund-1",
      "ops-1",
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/refunds/refund-1/review");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            refund: {
              ...createdRefund,
              status: "under_review",
              reviewerId: "ops-1",
              updatedAt: "2026-06-05T00:04:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
    );
    const resolvedRefund = await resolvePlatformRefund(
      "https://platform.example",
      "refund-1",
      {
        outcome: "partial_refund",
        reviewNote: "Partial refund approved.",
        refundAmount: "6.00"
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/refunds/refund-1/resolve");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            refund: {
              ...createdRefund,
              status: "partial_refund",
              reviewerId: "ops-1",
              reviewNote: "Partial refund approved.",
              refundAmount: "6.00",
              resolvedAt: "2026-06-05T00:05:00.000Z",
              updatedAt: "2026-06-05T00:05:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(developer.trustScore).toBe(82);
    expect(link.agentId).toBe("cursor");
    expect(settlement.payableAmount).toBe("14.40");
    expect(reputation.signals.pendingChainGrants).toBe(1);
    expect(review.summary.platformRating).toBe(100);
    expect(resolvedRefund.status).toBe("partial_refund");
    expect(resolvedRefund.refundAmount).toBe("6.00");
  });

  it("requests wallet export without private key material and migrates wallet", async () => {
    const exportResponse = await requestWalletExport(
      "https://platform.example",
      "web2-user-1",
      { freshGoogleAuth: true, secondFactorVerified: true },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/web2/users/web2-user-1/wallet/export/request");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            user: {
              platformUserId: "web2-user-1",
              walletAddress: "0x1111111111111111111111111111111111111111",
              identityWeight: 10,
              custodyMode: "backend_custodied_exportable",
              identity: { provider: "google", email: "demo@example.com" }
            },
            exportReceipt: {
              receiptId: "wallet-export-1",
              privateKeyMaterial: null
            }
          }),
          { status: 200 }
        );
      }
    );
    const migrated = await migrateWallet(
      "https://platform.example",
      "web2-user-1",
      {
        targetWalletAddress: "0x2222222222222222222222222222222222222222",
        ownershipProofVerified: true
      },
      async (url, init) => {
        expect(url).toBe("https://platform.example/api/web2/users/web2-user-1/wallet/migrate");
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            user: {
              platformUserId: "web2-user-1",
              walletAddress: "0x2222222222222222222222222222222222222222",
              identityWeight: 10,
              custodyMode: "external_migrated",
              identity: { provider: "google", email: "demo@example.com" }
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(exportResponse.exportReceipt.privateKeyMaterial).toBeNull();
    expect(migrated.custodyMode).toBe("external_migrated");
  });

  it("reads access bridge and admin inspect snapshots", async () => {
    const bridge = await getAccessBridge(
      "https://platform.example",
      "access-bridge-1",
      async (url) => {
        expect(url).toBe("https://platform.example/api/access-bridges/access-bridge-1");
        return new Response(
          JSON.stringify({
            accessBridge: {
              bridgeId: "access-bridge-1",
              orderId: "order-1",
              status: "pending_chain_grant",
              expectedGrantFunction: "grantRentalAccess",
              gatewayLeaseToken: "gateway-lease-1",
              gatewayLeaseIssuedAt: "2026-06-05T00:00:00.000Z",
              gatewayLeaseExpiresAt: "2026-07-05T00:00:00.000Z"
            }
          }),
          { status: 200 }
        );
      }
    );
    const inspect = await getPlatformAdminInspect(
      "https://platform.example",
      async (url) => {
        expect(url).toBe("https://platform.example/api/admin/inspect");
        return new Response(
          JSON.stringify({
            snapshot: {
              users: 1,
              creditAccounts: 1,
              orders: 1,
              accessBridges: 1,
              refunds: 0,
              paymentCallbacks: 1,
              developerProfiles: 1,
              settlements: 1
            }
          }),
          { status: 200 }
        );
      }
    );

    expect(bridge.status).toBe("pending_chain_grant");
    expect(bridge.expectedGrantFunction).toBe("grantRentalAccess");
    expect(inspect.snapshot.settlements).toBe(1);
  });
});
