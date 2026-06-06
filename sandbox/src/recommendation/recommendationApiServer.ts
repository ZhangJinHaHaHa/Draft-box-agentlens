import { createServer, type Server } from "node:http";

import { loadRecommendationCatalog } from "./loadRecommendationCatalog";
import { recommendFromCatalog } from "./recommendationService";
import type {
  RecommendationAccessType,
  RecommendationComplexity,
  RecommendationPriority,
  RecommendationRequest,
  RecommendationRiskLevel
} from "./recommendationTypes";
import type { RecommendationApiConfig } from "./readRecommendationApiConfig";

interface RecommendationRequestLike extends AsyncIterable<Buffer | string> {
  method?: string;
  url?: string;
}

interface RecommendationResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export function createRecommendationApiServer(config: RecommendationApiConfig): Server {
  const catalog = loadRecommendationCatalog(config.catalogPath);
  return createServer((request, response) =>
    void handleRecommendationApiRequest(request, response, catalog)
  );
}

export async function handleRecommendationApiRequest(
  request: RecommendationRequestLike,
  response: RecommendationResponseLike,
  catalog: ReturnType<typeof loadRecommendationCatalog>
): Promise<void> {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end("");
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, {
      status: "ok",
      catalogSize: catalog.length
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/recommendations") {
    try {
      const payload = parseRecommendationRequest(await readJsonBody(request));
      writeJson(response, 200, recommendFromCatalog(catalog, payload));
    } catch (error) {
      writeJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid recommendation request."
      });
    }
    return;
  }

  writeJson(response, 404, { error: "not found" });
}

async function readJsonBody(request: RecommendationRequestLike): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (rawBody.trim().length === 0) {
    return {};
  }
  return JSON.parse(rawBody);
}

export function parseRecommendationRequest(payload: unknown): RecommendationRequest {
  if (!payload || typeof payload !== "object") {
    throw new Error("Recommendation request must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (!query) {
    throw new Error("query is required.");
  }

  const parsed: RecommendationRequest = { query };
  if (record.scenarioIds) {
    parsed.scenarioIds = readStringArray(record.scenarioIds, "scenarioIds");
  }
  if (record.accessTypes) {
    parsed.accessTypes = readAccessTypes(record.accessTypes);
  }
  if (record.maxRiskLevel) {
    parsed.maxRiskLevel = readEnum(record.maxRiskLevel, ["low", "medium", "high"] as const, "maxRiskLevel");
  }
  if (record.complexity) {
    parsed.complexity = readEnum(record.complexity, ["low", "medium", "high"] as const, "complexity");
  }
  if (record.priorities) {
    parsed.priorities = readPriorities(record.priorities);
  }
  if (typeof record.limit === "number") {
    parsed.limit = record.limit;
  }
  return parsed;
}

function readStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function readAccessTypes(value: unknown): RecommendationAccessType[] {
  return readArrayEnum(value, ["api", "saas", "cli", "browser_ext", "local", "cloud"] as const, "accessTypes");
}

function readPriorities(value: unknown): RecommendationPriority[] {
  return readArrayEnum(value, ["low-risk", "fast-start", "self-host", "api-first", "audited"] as const, "priorities");
}

function readArrayEnum<T extends string>(value: unknown, allowed: readonly T[], key: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }
  return value.map((item) => readEnum(item, allowed, key));
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], key: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function writeJson(response: RecommendationResponseLike, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function setCorsHeaders(response: RecommendationResponseLike): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
