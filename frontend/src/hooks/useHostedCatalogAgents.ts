import { useEffect, useState } from "react";

import type { AppConfig } from "@/config/appConfig";
import type { AgentCatalogEntry } from "@/domain/catalog";
import { mapHostedAgentsToCatalogEntries } from "@/domain/hostedCatalog";
import { listHostedAgents } from "@/lib/hostedAgentClient";

export type HostedCatalogStatus = "idle" | "loading" | "ready" | "error";

interface UseHostedCatalogAgentsResult {
  status: HostedCatalogStatus;
  agents: AgentCatalogEntry[];
  errorMessage: string | null;
}

export function useHostedCatalogAgents(config: AppConfig): UseHostedCatalogAgentsResult {
  const [state, setState] = useState<UseHostedCatalogAgentsResult>({
    status: "idle",
    agents: [],
    errorMessage: null
  });

  useEffect(() => {
    const endpointUrl = config.hostedAgentApiUrl;
    if (!endpointUrl) {
      setState({ status: "idle", agents: [], errorMessage: null });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", agents: [], errorMessage: null });

    listHostedAgents({ endpointUrl })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setState({ status: "error", agents: [], errorMessage: result.error });
          return;
        }
        setState({
          status: "ready",
          agents: mapHostedAgentsToCatalogEntries(result.items),
          errorMessage: null
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          agents: [],
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      });

    return () => {
      cancelled = true;
    };
  }, [config.hostedAgentApiUrl]);

  return state;
}
