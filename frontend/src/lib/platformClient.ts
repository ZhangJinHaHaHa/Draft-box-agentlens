import type { RecommendationRequest } from "@/domain/recommendation";

import {
  parseRecommendationApiResponse,
  type RecommendationApiResponse
} from "./recommendationClient";

export interface PlatformUser {
  platformUserId: string;
  walletAddress: string;
  identityWeight: number;
  custodyMode: string;
  identity: {
    provider: "google";
    email: string;
  };
}

export interface PlatformCreditAccount {
  userId: string;
  balance: number;
  updatedAt: string;
}

export interface PlatformMockGoogleLoginResponse {
  user: PlatformUser;
  creditAccount: PlatformCreditAccount;
}

export interface PaidLlmRecommendationResponse {
  engine: string;
  charged: boolean;
  fallbackUsed: boolean;
  costCredits: number;
  creditAccount: PlatformCreditAccount;
  recommendation: RecommendationApiResponse;
}

export async function createMockGoogleUser(
  apiBaseUrl: string,
  input: { googleSubject: string; email: string },
  fetchImpl: typeof fetch = fetch
): Promise<PlatformMockGoogleLoginResponse> {
  const payload = await postJson(apiBaseUrl, "/api/web2/google/mock", input, fetchImpl);
  return parseMockGoogleLoginResponse(payload);
}

export async function requestPaidLlmRecommendation(
  apiBaseUrl: string,
  request: RecommendationRequest & { userId: string },
  fetchImpl: typeof fetch = fetch
): Promise<PaidLlmRecommendationResponse> {
  const payload = await postJson(apiBaseUrl, "/api/recommendations/llm", request, fetchImpl);
  return parsePaidLlmRecommendationResponse(payload);
}

export async function getPlatformCredits(
  apiBaseUrl: string,
  userId: string,
  fetchImpl: typeof fetch = fetch
): Promise<PlatformCreditAccount> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}/api/web2/users/${encodeURIComponent(userId)}/credits`);
  if (!response.ok) {
    throw new Error(`Platform API responded with status ${response.status}.`);
  }
  const payload = await response.json();
  return parseCreditAccount((payload as { creditAccount?: unknown }).creditAccount);
}

async function postJson(
  apiBaseUrl: string,
  path: string,
  body: unknown,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Platform API responded with status ${response.status}.`);
  }

  return response.json();
}

function parseMockGoogleLoginResponse(payload: unknown): PlatformMockGoogleLoginResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform login response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  return {
    user: parsePlatformUser(record.user),
    creditAccount: parseCreditAccount(record.creditAccount)
  };
}

function parsePaidLlmRecommendationResponse(payload: unknown): PaidLlmRecommendationResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("Paid recommendation response must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.engine !== "string") {
    throw new Error("Paid recommendation engine is required.");
  }
  if (typeof record.charged !== "boolean") {
    throw new Error("Paid recommendation charged flag is required.");
  }
  if (typeof record.fallbackUsed !== "boolean") {
    throw new Error("Paid recommendation fallback flag is required.");
  }
  if (typeof record.costCredits !== "number" || !Number.isFinite(record.costCredits)) {
    throw new Error("Paid recommendation costCredits must be a number.");
  }

  return {
    engine: record.engine,
    charged: record.charged,
    fallbackUsed: record.fallbackUsed,
    costCredits: record.costCredits,
    creditAccount: parseCreditAccount(record.creditAccount),
    recommendation: parseRecommendationApiResponse(record.recommendation)
  };
}

function parsePlatformUser(payload: unknown): PlatformUser {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform user must be an object.");
  }
  const record = payload as Record<string, unknown>;
  const identity = record.identity as Record<string, unknown> | undefined;
  if (typeof record.platformUserId !== "string" || record.platformUserId.trim().length === 0) {
    throw new Error("Platform user id is required.");
  }
  if (typeof record.walletAddress !== "string" || record.walletAddress.trim().length === 0) {
    throw new Error("Platform wallet address is required.");
  }
  if (typeof record.identityWeight !== "number" || !Number.isFinite(record.identityWeight)) {
    throw new Error("Platform identity weight must be a number.");
  }
  if (typeof record.custodyMode !== "string") {
    throw new Error("Platform custody mode is required.");
  }
  if (!identity || identity.provider !== "google" || typeof identity.email !== "string") {
    throw new Error("Platform user Google identity is required.");
  }

  return {
    platformUserId: record.platformUserId.trim(),
    walletAddress: record.walletAddress.trim(),
    identityWeight: record.identityWeight,
    custodyMode: record.custodyMode,
    identity: {
      provider: "google",
      email: identity.email
    }
  };
}

function parseCreditAccount(payload: unknown): PlatformCreditAccount {
  if (!payload || typeof payload !== "object") {
    throw new Error("Platform credit account must be an object.");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.userId !== "string" || record.userId.trim().length === 0) {
    throw new Error("Platform credit account userId is required.");
  }
  if (typeof record.balance !== "number" || !Number.isFinite(record.balance)) {
    throw new Error("Platform credit account balance must be a number.");
  }
  if (typeof record.updatedAt !== "string") {
    throw new Error("Platform credit account updatedAt is required.");
  }

  return {
    userId: record.userId.trim(),
    balance: record.balance,
    updatedAt: record.updatedAt
  };
}
