import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createPersistentPlatformApiStore,
  resolvePlatformApiStateDir
} from "../../src/platform/persistentPlatformApiStore";

test("resolvePlatformApiStateDir defaults under .runtime/platform-api", () => {
  assert.equal(
    resolvePlatformApiStateDir(undefined, "/tmp/project"),
    join("/tmp/project", ".runtime", "platform-api")
  );
});

test("createPersistentPlatformApiStore reloads users and credit balances", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}platform-api-store-`);

  try {
    const firstStore = createPersistentPlatformApiStore({
      stateDir,
      now: () => "2026-06-05T00:00:00.000Z"
    });
    const user = firstStore.createGoogleMockUser({
      googleSubject: "google-sub-1",
      email: "user@example.com"
    });
    firstStore.spendPlatformCredits(user.platformUserId, {
      amount: 3,
      reason: "llm_recommendation"
    });

    const reloadedStore = createPersistentPlatformApiStore({
      stateDir,
      now: () => "2026-06-05T00:01:00.000Z"
    });
    const reloadedUser = reloadedStore.getUser(user.platformUserId);
    const creditAccount = reloadedStore.getCreditAccount(user.platformUserId);

    assert.equal(reloadedUser.walletAddress, user.walletAddress);
    assert.equal(creditAccount.balance, 97);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createPersistentPlatformApiStore reloads developer, bridge and settlement state", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}platform-api-store-`);

  try {
    const firstStore = createPersistentPlatformApiStore({
      stateDir,
      now: () => "2026-06-05T00:00:00.000Z"
    });
    const developer = firstStore.createDeveloperProfile({
      displayName: "Dify Labs",
      walletAddress: "0x3333333333333333333333333333333333333333",
      trustStatus: "verified",
      trustScore: 82
    });
    firstStore.linkAgentToDeveloper("dify", developer.developerId);
    const user = firstStore.createGoogleMockUser({
      googleSubject: "google-sub-1",
      email: "user@example.com"
    });
    const order = firstStore.createOrder({
      userId: user.platformUserId,
      agentId: "dify",
      amount: "20.00",
      currency: "CREDITS"
    });
    const paid = firstStore.applyMockPaymentCallback({
      orderId: order.orderId,
      paymentProvider: "stripe-mock",
      providerPaymentId: "pay-1",
      idempotencyKey: "idem-1",
      paidAmount: "20.00"
    });

    const reloadedStore = createPersistentPlatformApiStore({
      stateDir,
      now: () => "2026-06-05T00:01:00.000Z"
    });
    const reloadedDeveloper = reloadedStore.getDeveloperForAgent("dify");
    const bridge = reloadedStore.getAccessBridge(paid.bridge.bridgeId);
    const settlement = reloadedStore.getSettlementForOrder(order.orderId);
    const inspect = reloadedStore.inspect();

    assert.equal(reloadedDeveloper.developer.developerId, developer.developerId);
    assert.equal(bridge.status, "pending_chain_grant");
    assert.equal(bridge.expectedGrantFunction, "grantRentalAccess");
    assert.equal(settlement.developerId, developer.developerId);
    assert.equal(inspect.snapshot.developerProfiles, 1);
    assert.equal(inspect.snapshot.settlements, 1);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("createPersistentPlatformApiStore reloads usage reviews", async () => {
  const stateDir = await mkdtemp(`${tmpdir()}${sep}platform-api-store-`);

  try {
    const firstStore = createPersistentPlatformApiStore({
      stateDir,
      now: () => "2026-06-05T00:00:00.000Z"
    });
    const user = firstStore.createGoogleMockUser({
      googleSubject: "google-sub-1",
      email: "user@example.com"
    });
    const order = firstStore.createOrder({
      userId: user.platformUserId,
      agentId: "dify",
      amount: "20.00",
      currency: "CREDITS"
    });
    const paid = firstStore.applyMockPaymentCallback({
      orderId: order.orderId,
      paymentProvider: "stripe-mock",
      providerPaymentId: "pay-1",
      idempotencyKey: "idem-1",
      paidAmount: "20.00"
    });
    const review = firstStore.submitUsageReview({
      orderId: order.orderId,
      userId: user.platformUserId,
      overallRating: 5,
      capabilityMatched: true,
      commentText: "Works as promised."
    });

    const reloadedStore = createPersistentPlatformApiStore({
      stateDir,
      now: () => "2026-06-05T00:01:00.000Z"
    });
    const reloadedReview = reloadedStore.getUsageReviewForOrder(order.orderId);
    const summary = reloadedStore.getAgentUsageReviewSummary("dify");
    const inspect = reloadedStore.inspect();

    assert.equal(reloadedReview?.reviewId, review.reviewId);
    assert.equal(summary.reviewCount, 1);
    assert.equal(summary.platformRating, 100);
    assert.equal(inspect.snapshot.usageReviews, 1);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
