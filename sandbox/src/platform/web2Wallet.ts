export type Web2IdentityProvider = "google";
export type WalletCustodyMode = "backend_custodied_exportable" | "external_migrated";
export type WalletExportStatus = "not_requested" | "ready" | "completed" | "cancelled";

export interface GoogleIdentityProfile {
  provider: Web2IdentityProvider;
  subject: string;
  email: string;
  emailVerified: boolean;
}

export interface Web2UserWallet {
  platformUserId: string;
  identity: GoogleIdentityProfile;
  walletAddress: string;
  previousWalletAddress?: string;
  custodyMode: WalletCustodyMode;
  exportStatus: WalletExportStatus;
  identityWeight: number;
  createdAt: string;
  updatedAt: string;
  exportRequestedAt?: string;
  exportedAt?: string;
  migratedAt?: string;
}

export interface WalletExportAuthContext {
  freshGoogleAuth: boolean;
  secondFactorVerified: boolean;
}

export function createGoogleBackedWallet(
  input: {
    platformUserId: string;
    identity: GoogleIdentityProfile;
    walletAddress: string;
  },
  at: string
): Web2UserWallet {
  if (!input.identity.emailVerified) {
    throw new Error("Google email must be verified before wallet creation.");
  }
  assertEthereumAddress(input.walletAddress, "walletAddress");

  return {
    platformUserId: input.platformUserId,
    identity: input.identity,
    walletAddress: input.walletAddress,
    custodyMode: "backend_custodied_exportable",
    exportStatus: "not_requested",
    identityWeight: 10,
    createdAt: at,
    updatedAt: at
  };
}

export function requestWalletExport(
  wallet: Web2UserWallet,
  auth: WalletExportAuthContext,
  at: string
): Web2UserWallet {
  assertCustodiedWallet(wallet);
  assertStrongExportAuth(auth);

  return {
    ...wallet,
    exportStatus: "ready",
    exportRequestedAt: at,
    updatedAt: at
  };
}

export function completeWalletExport(wallet: Web2UserWallet, at: string): Web2UserWallet {
  assertCustodiedWallet(wallet);
  if (wallet.exportStatus !== "ready") {
    throw new Error("Wallet export must be requested before it can be completed.");
  }

  return {
    ...wallet,
    exportStatus: "completed",
    exportedAt: at,
    updatedAt: at
  };
}

export function cancelWalletExport(wallet: Web2UserWallet, at: string): Web2UserWallet {
  assertCustodiedWallet(wallet);
  if (wallet.exportStatus !== "ready") {
    throw new Error("Only a ready wallet export can be cancelled.");
  }

  return {
    ...wallet,
    exportStatus: "cancelled",
    updatedAt: at
  };
}

export function migrateWalletToExternalAddress(
  wallet: Web2UserWallet,
  targetWalletAddress: string,
  ownershipProofVerified: boolean,
  at: string
): Web2UserWallet {
  assertEthereumAddress(targetWalletAddress, "targetWalletAddress");
  if (!ownershipProofVerified) {
    throw new Error("Target wallet ownership proof must be verified before migration.");
  }
  if (targetWalletAddress.toLowerCase() === wallet.walletAddress.toLowerCase()) {
    throw new Error("Target wallet address must differ from the current wallet address.");
  }

  return {
    ...wallet,
    previousWalletAddress: wallet.walletAddress,
    walletAddress: targetWalletAddress,
    custodyMode: "external_migrated",
    migratedAt: at,
    updatedAt: at
  };
}

function assertCustodiedWallet(wallet: Web2UserWallet): void {
  if (wallet.custodyMode !== "backend_custodied_exportable") {
    throw new Error("Only backend-custodied wallets can use the export flow.");
  }
}

function assertStrongExportAuth(auth: WalletExportAuthContext): void {
  if (!auth.freshGoogleAuth || !auth.secondFactorVerified) {
    throw new Error("Wallet export requires fresh Google auth and second-factor verification.");
  }
}

export function assertEthereumAddress(value: string, fieldName: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${fieldName} must be a valid EVM address.`);
  }
}
