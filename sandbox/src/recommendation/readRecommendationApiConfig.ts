import path from "node:path";

export interface RecommendationApiConfig {
  host: string;
  port: number;
  catalogPath?: string;
}

export function readRecommendationApiConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): RecommendationApiConfig {
  const host = readOptionalString(env.PLATFORM_RECOMMENDATION_HOST) ?? "127.0.0.1";
  const port = readPort(env.PLATFORM_RECOMMENDATION_PORT, 8787);
  const catalogPath = readOptionalString(env.PLATFORM_RECOMMENDATION_CATALOG_PATH);

  return {
    host,
    port,
    ...(catalogPath ? { catalogPath: path.resolve(catalogPath) } : {})
  };
}

function readOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readPort(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error("PLATFORM_RECOMMENDATION_PORT must be a positive integer.");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PLATFORM_RECOMMENDATION_PORT must be between 1 and 65535.");
  }
  return port;
}
