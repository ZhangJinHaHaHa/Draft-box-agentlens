import type {
  HostedAgentDraft,
  HostedAgentHealthcheckResult
} from "./hostedAgentTypes";

export interface HostedAgentHealthcheckOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

export async function runHostedAgentHealthcheck(
  agent: HostedAgentDraft,
  options: HostedAgentHealthcheckOptions = {}
): Promise<HostedAgentHealthcheckResult> {
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const url = agent.integration.healthcheckUrl;

  if (!url) {
    return {
      status: "not_configured",
      checkedAt
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal
    });

    return {
      status: response.ok ? "passed" : "failed",
      checkedAt,
      url,
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      status: "failed",
      checkedAt,
      url,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Healthcheck request failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}
