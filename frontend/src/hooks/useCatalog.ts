import { useMemo } from "react";

import { curatedAgents } from "@/data/catalog/curated";
import { listedAgents } from "@/data/catalog/listed";
import { marketplaceAgents } from "@/data/catalog/marketplace";
import type { AgentCatalogEntry, MergedCatalog } from "@/domain/catalog";
import { mergeCatalog } from "@/domain/catalog";
import type { AppConfig } from "@/config/appConfig";

import { useHostedCatalogAgents, type HostedCatalogStatus } from "./useHostedCatalogAgents";
import { useNativeAgents, type NativeAgentsStatus } from "./useNativeAgents";

interface UseCatalogOptions {
  config: AppConfig;
  /** Inject for testing — defaults to a real ethers client. */
  nativeAgents?: AgentCatalogEntry[];
  /** Skip the on-chain fetch entirely (e.g. for SSR/snapshot). */
  skipNative?: boolean;
}

export interface UseCatalogResult extends MergedCatalog {
  nativeStatus: NativeAgentsStatus;
  nativeError: string | null;
  hostedStatus: HostedCatalogStatus;
  hostedError: string | null;
}

const NOOP_NATIVE_CLIENT = createNoopClient();

export function useCatalog({ config, nativeAgents, skipNative }: UseCatalogOptions): UseCatalogResult {
  const hosted = useHostedCatalogAgents(config);
  const native = useNativeAgents({
    config,
    client: skipNative ? NOOP_NATIVE_CLIENT : undefined
  });

  const merged = useMemo(() => {
    const sourceNative = nativeAgents ?? (skipNative ? [] : native.agents);
    const marketplace = [...hosted.agents, ...marketplaceAgents];
    return mergeCatalog({
      curated: curatedAgents,
      listed: listedAgents,
      marketplace,
      native: sourceNative
    });
  }, [hosted.agents, native.agents, nativeAgents, skipNative]);

  return {
    ...merged,
    nativeStatus: skipNative ? "idle" : native.status,
    nativeError: native.errorMessage,
    hostedStatus: hosted.status,
    hostedError: hosted.errorMessage
  };
}

function createNoopClient() {
  return {
    async getAgentProfile() {
      throw new Error("TOKEN_NOT_FOUND: native fetching disabled");
    },
    async getLatestAuditReport() {
      throw new Error("NO_AUDIT_RECORD");
    },
    async getAuditCount() {
      return 0n;
    },
    async getAuditReportByIndex() {
      throw new Error("NO_AUDIT_RECORD");
    }
  };
}
