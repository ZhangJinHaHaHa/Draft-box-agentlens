import { createHostedAgentApiServer } from "../hosted/hostedAgentApiServer";
import {
  createHostedAgentStore,
  resolveHostedAgentStateDirFromEnv
} from "../hosted/hostedAgentStore";
import {
  createHostedAgentGatewayStore,
  resolveHostedAgentGatewayStateDirFromEnv
} from "../hosted/hostedAgentGatewayStore";

function readPortFromEnv(value: string | undefined): number {
  if (!value) {
    return 3001;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("HOSTED_AGENT_API_PORT must be a non-negative integer.");
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("HOSTED_AGENT_API_PORT must be between 0 and 65535.");
  }

  return port;
}

async function main(): Promise<void> {
  const stateDir = resolveHostedAgentStateDirFromEnv(process.env);
  const gatewayStateDir = resolveHostedAgentGatewayStateDirFromEnv(process.env);
  const store = createHostedAgentStore({ stateDir });
  const gatewayStore = createHostedAgentGatewayStore({ stateDir: gatewayStateDir });
  const server = createHostedAgentApiServer({ store, gatewayStore });
  const port = readPortFromEnv(process.env.HOSTED_AGENT_API_PORT);
  const host = process.env.HOSTED_AGENT_API_HOST || "0.0.0.0";

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve();
    });
  });

  process.stdout.write(
    `${JSON.stringify({ type: "hosted-agent-api-listening", host, port, stateDir, gatewayStateDir })}\n`
  );
}

if (require.main === module) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
