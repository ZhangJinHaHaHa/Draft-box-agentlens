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
