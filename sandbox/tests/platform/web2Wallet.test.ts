import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelWalletExport,
  completeWalletExport,
  createGoogleBackedWallet,
  migrateWalletToExternalAddress,
  requestWalletExport,
  type GoogleIdentityProfile
} from "../../src/platform/web2Wallet";

const identity: GoogleIdentityProfile = {
  provider: "google",
  subject: "google-sub-1",
  email: "user@example.com",
  emailVerified: true
};

const wallet = createGoogleBackedWallet(
  {
    platformUserId: "user-1",
    identity,
    walletAddress: "0x1111111111111111111111111111111111111111"
  },
  "2026-06-05T00:00:00.000Z"
);

test("createGoogleBackedWallet creates an exportable custodial wallet", () => {
  assert.equal(wallet.custodyMode, "backend_custodied_exportable");
  assert.equal(wallet.exportStatus, "not_requested");
  assert.equal(wallet.identityWeight, 10);
});

test("createGoogleBackedWallet rejects unverified Google email", () => {
  assert.throws(
    () =>
      createGoogleBackedWallet(
        {
          platformUserId: "user-2",
          identity: { ...identity, emailVerified: false },
          walletAddress: "0x1111111111111111111111111111111111111111"
        },
        "2026-06-05T00:00:00.000Z"
      ),
    /Google email must be verified/
  );
});

test("requestWalletExport requires fresh auth and second factor", () => {
  assert.throws(
    () =>
      requestWalletExport(
        wallet,
        { freshGoogleAuth: true, secondFactorVerified: false },
        "2026-06-05T00:01:00.000Z"
      ),
    /fresh Google auth and second-factor/
  );

  const ready = requestWalletExport(
    wallet,
    { freshGoogleAuth: true, secondFactorVerified: true },
    "2026-06-05T00:01:00.000Z"
  );
  assert.equal(ready.exportStatus, "ready");
});

test("completeWalletExport records a completed export", () => {
  const ready = requestWalletExport(
    wallet,
    { freshGoogleAuth: true, secondFactorVerified: true },
    "2026-06-05T00:01:00.000Z"
  );
  const exported = completeWalletExport(ready, "2026-06-05T00:02:00.000Z");

  assert.equal(exported.exportStatus, "completed");
  assert.equal(exported.exportedAt, "2026-06-05T00:02:00.000Z");
});

test("cancelWalletExport cancels only ready exports", () => {
  assert.throws(
    () => cancelWalletExport(wallet, "2026-06-05T00:01:00.000Z"),
    /Only a ready wallet export can be cancelled/
  );

  const ready = requestWalletExport(
    wallet,
    { freshGoogleAuth: true, secondFactorVerified: true },
    "2026-06-05T00:01:00.000Z"
  );
  const cancelled = cancelWalletExport(ready, "2026-06-05T00:02:00.000Z");
  assert.equal(cancelled.exportStatus, "cancelled");
});

test("migrateWalletToExternalAddress moves ownership to a verified target wallet", () => {
  const migrated = migrateWalletToExternalAddress(
    wallet,
    "0x2222222222222222222222222222222222222222",
    true,
    "2026-06-05T00:03:00.000Z"
  );

  assert.equal(migrated.custodyMode, "external_migrated");
  assert.equal(migrated.previousWalletAddress, wallet.walletAddress);
  assert.equal(migrated.walletAddress, "0x2222222222222222222222222222222222222222");
});

test("migrateWalletToExternalAddress requires ownership proof", () => {
  assert.throws(
    () =>
      migrateWalletToExternalAddress(
        wallet,
        "0x2222222222222222222222222222222222222222",
        false,
        "2026-06-05T00:03:00.000Z"
      ),
    /ownership proof/
  );
});
