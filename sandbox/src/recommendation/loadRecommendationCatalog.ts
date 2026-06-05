import fs from "node:fs";

import { defaultRecommendationCatalog } from "./defaultRecommendationCatalog";
import type { RecommendationCatalogEntry } from "./recommendationTypes";

export function loadRecommendationCatalog(catalogPath?: string): RecommendationCatalogEntry[] {
  if (!catalogPath) {
    return defaultRecommendationCatalog;
  }

  const parsed = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Recommendation catalog must be a JSON array.");
  }

  return parsed.map(parseCatalogEntry);
}

function parseCatalogEntry(value: unknown): RecommendationCatalogEntry {
  if (!value || typeof value !== "object") {
    throw new Error("Recommendation catalog entry must be an object.");
  }

  const record = value as Record<string, unknown>;
  const entry: RecommendationCatalogEntry = {
    id: readRequiredString(record, "id"),
    name: readRequiredString(record, "name"),
    ...(readOptionalString(record.vendor) ? { vendor: readOptionalString(record.vendor) } : {}),
    intro: {
      zh: readRequiredString(record.intro as Record<string, unknown>, "zh"),
      en: readRequiredString(record.intro as Record<string, unknown>, "en")
    },
    category: readRequiredString(record, "category"),
    tags: readStringArray(record.tags, "tags"),
    scenarioIds: readStringArray(record.scenarioIds, "scenarioIds"),
    unsuitableScenarioIds: readStringArray(record.unsuitableScenarioIds, "unsuitableScenarioIds"),
    riskLevel: readEnum(record.riskLevel, ["low", "medium", "high"] as const, "riskLevel"),
    accessTypes: readArrayEnum(record.accessTypes, ["api", "saas", "cli", "browser_ext", "local", "cloud"] as const, "accessTypes"),
    complexity: readEnum(record.complexity, ["low", "medium", "high"] as const, "complexity"),
    hasOnboardingGuide: Boolean(record.hasOnboardingGuide),
    ...(typeof record.hasAuditEvidence === "boolean" ? { hasAuditEvidence: record.hasAuditEvidence } : {}),
    ...(readOptionalString(record.source) ? { source: readEnum(record.source, ["curated", "listed", "native"] as const, "source") } : {})
  };

  return entry;
}

function readRequiredString(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${key} must be an array of strings.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], key: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function readArrayEnum<T extends string>(value: unknown, allowed: readonly T[], key: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }
  return value.map((item) => readEnum(item, allowed, key));
}
