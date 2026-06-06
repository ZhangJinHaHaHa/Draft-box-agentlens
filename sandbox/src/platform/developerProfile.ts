import { assertEthereumAddress } from "./web2Wallet";

export type DeveloperTrustStatus = "unverified" | "verified" | "suspended";

export interface DeveloperProfile {
  developerId: string;
  displayName: string;
  walletAddress: string;
  websiteUrl?: string;
  supportContact?: string;
  trustStatus: DeveloperTrustStatus;
  trustScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDeveloperLink {
  agentId: string;
  developerId: string;
  linkedAt: string;
}

export function createDeveloperProfile(
  input: {
    developerId: string;
    displayName: string;
    walletAddress: string;
    websiteUrl?: string;
    supportContact?: string;
    trustStatus?: DeveloperTrustStatus;
    trustScore?: number;
  },
  at: string
): DeveloperProfile {
  const displayName = readRequiredTrimmed(input.displayName, "displayName");
  assertEthereumAddress(input.walletAddress, "walletAddress");
  const trustScore = input.trustScore ?? 50;
  if (!Number.isInteger(trustScore) || trustScore < 0 || trustScore > 100) {
    throw new Error("trustScore must be an integer between 0 and 100.");
  }

  return {
    developerId: readRequiredTrimmed(input.developerId, "developerId"),
    displayName,
    walletAddress: input.walletAddress,
    websiteUrl: readOptionalTrimmed(input.websiteUrl),
    supportContact: readOptionalTrimmed(input.supportContact),
    trustStatus: input.trustStatus ?? "unverified",
    trustScore,
    createdAt: at,
    updatedAt: at
  };
}

export function linkAgentToDeveloper(
  input: {
    agentId: string;
    developerId: string;
  },
  at: string
): AgentDeveloperLink {
  return {
    agentId: readRequiredTrimmed(input.agentId, "agentId"),
    developerId: readRequiredTrimmed(input.developerId, "developerId"),
    linkedAt: at
  };
}

function readRequiredTrimmed(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

function readOptionalTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
