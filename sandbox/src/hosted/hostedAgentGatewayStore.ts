import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface HostedAgentSecretInput {
  authHeaderName: string;
  authHeaderValue: string;
}

export interface HostedAgentSecretRecord {
  hostedAgentId: string;
  authHeaderName: string;
  authHeaderValue: string;
  updatedAt: string;
}

export interface HostedAgentLeaseInput {
  hostedAgentId: string;
  userId: string;
  durationHours: number;
  maxRequests: number;
  maxRequestsPerMinute?: number;
}

export interface HostedAgentLeaseRecord {
  leaseId: string;
  hostedAgentId: string;
  userId: string;
  accessTokenHash: string;
  createdAt: string;
  expiresAt: string;
  maxRequests: number;
  maxRequestsPerMinute: number;
  requestCount: number;
  revokedAt?: string;
}

export interface HostedAgentLeaseGrant extends Omit<HostedAgentLeaseRecord, "accessTokenHash"> {
  accessToken: string;
}

export interface HostedAgentUsageLog {
  requestId: string;
  hostedAgentId: string;
  leaseId: string;
  userId: string;
  status: "succeeded" | "failed" | "rejected";
  createdAt: string;
  latencyMs: number;
  downstreamStatus?: number;
  error?: string;
}

export type HostedAgentLeaseConsumptionResult =
  | {
      status: "consumed";
      lease: HostedAgentLeaseRecord;
    }
  | {
      status: "quota_exceeded";
      lease: HostedAgentLeaseRecord;
    }
  | {
      status: "not_found";
    };

export interface HostedAgentGatewaySummary {
  secretConfigured: boolean;
  activeLeaseCount: number;
  totalRequestCount: number;
  failedRequestCount: number;
  latestRequestAt?: string;
}

export interface HostedAgentGatewayStore {
  readonly stateDir: string;
  createRequestId(): string;
  upsertSecret(hostedAgentId: string, input: HostedAgentSecretInput): Promise<HostedAgentSecretRecord>;
  findSecret(hostedAgentId: string): Promise<HostedAgentSecretRecord | undefined>;
  createLease(input: HostedAgentLeaseInput): Promise<HostedAgentLeaseGrant>;
  findLeaseByToken(hostedAgentId: string, accessToken: string): Promise<HostedAgentLeaseRecord | undefined>;
  consumeLeaseRequest(leaseId: string): Promise<HostedAgentLeaseConsumptionResult>;
  incrementLeaseRequestCount(leaseId: string): Promise<HostedAgentLeaseRecord | undefined>;
  countRecentUsage(leaseId: string, since: Date): Promise<number>;
  recordUsage(log: HostedAgentUsageLog): Promise<HostedAgentUsageLog>;
  summarizeGateway(hostedAgentId: string): Promise<HostedAgentGatewaySummary>;
}

export interface HostedAgentGatewayStoreOptions {
  stateDir: string;
  now?: () => Date;
  createLeaseId?: () => string;
  createRequestId?: () => string;
  createAccessToken?: () => string;
}

interface HostedAgentGatewayStoreFile {
  secrets: HostedAgentSecretRecord[];
  leases: HostedAgentLeaseRecord[];
  usage: HostedAgentUsageLog[];
  updatedAt: string;
}

type HostedAgentGatewayEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

const GATEWAY_FILE_NAME = "hosted-agent-gateway.json";
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 10;

export function resolveDefaultHostedAgentGatewayStateDir(cwd: string = process.cwd()): string {
  return join(cwd, ".runtime", "hosted-agent-gateway");
}

export function resolveHostedAgentGatewayStateDir(stateDir?: string, cwd?: string): string {
  return stateDir ?? resolveDefaultHostedAgentGatewayStateDir(cwd);
}

export function resolveHostedAgentGatewayStateDirFromEnv(
  env: HostedAgentGatewayEnv,
  cwd?: string
): string {
  return resolveHostedAgentGatewayStateDir(env.HOSTED_AGENT_GATEWAY_STATE_DIR, cwd);
}

export function hashAccessToken(accessToken: string): string {
  return createHash("sha256").update(accessToken).digest("hex");
}

export function createHostedAgentGatewayStore(
  options: HostedAgentGatewayStoreOptions
): HostedAgentGatewayStore {
  const now = options.now ?? (() => new Date());
  const createRequestId =
    options.createRequestId ?? (() => `hreq-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`);
  const createLeaseId =
    options.createLeaseId ?? (() => `hlease-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`);
  const createAccessToken =
    options.createAccessToken ?? (() => `agl_${randomBytes(24).toString("base64url")}`);
  const filePath = join(options.stateDir, GATEWAY_FILE_NAME);
  let mutationQueue: Promise<void> = Promise.resolve();

  async function ensureDirectory(): Promise<void> {
    await mkdir(options.stateDir, { recursive: true });
  }

  async function readStoreFile(): Promise<HostedAgentGatewayStoreFile> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as HostedAgentGatewayStoreFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          secrets: [],
          leases: [],
          usage: [],
          updatedAt: now().toISOString()
        };
      }

      throw error;
    }
  }

  async function writeStoreFile(value: HostedAgentGatewayStoreFile): Promise<void> {
    await ensureDirectory();
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(
      tempPath,
      JSON.stringify({ ...value, updatedAt: now().toISOString() }, null, 2),
      "utf8"
    );
    await rename(tempPath, filePath);
  }

  function isLeaseActive(lease: HostedAgentLeaseRecord, at: Date): boolean {
    return !lease.revokedAt && new Date(lease.expiresAt).getTime() > at.getTime();
  }

  async function withMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = mutationQueue;
    let release: () => void = () => {};
    mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  return {
    stateDir: options.stateDir,
    createRequestId,
    async upsertSecret(hostedAgentId, input): Promise<HostedAgentSecretRecord> {
      return withMutation(async () => {
        const storeFile = await readStoreFile();
        const existingIndex = storeFile.secrets.findIndex((item) => item.hostedAgentId === hostedAgentId);
        const record: HostedAgentSecretRecord = {
          hostedAgentId,
          authHeaderName: input.authHeaderName,
          authHeaderValue: input.authHeaderValue,
          updatedAt: now().toISOString()
        };

        if (existingIndex === -1) {
          storeFile.secrets.push(record);
        } else {
          storeFile.secrets[existingIndex] = record;
        }

        await writeStoreFile(storeFile);
        return record;
      });
    },
    async findSecret(hostedAgentId): Promise<HostedAgentSecretRecord | undefined> {
      const storeFile = await readStoreFile();
      return storeFile.secrets.find((item) => item.hostedAgentId === hostedAgentId);
    },
    async createLease(input): Promise<HostedAgentLeaseGrant> {
      return withMutation(async () => {
        const storeFile = await readStoreFile();
        const createdAt = now();
        const accessToken = createAccessToken();
        const lease: HostedAgentLeaseRecord = {
          leaseId: createLeaseId(),
          hostedAgentId: input.hostedAgentId,
          userId: input.userId,
          accessTokenHash: hashAccessToken(accessToken),
          createdAt: createdAt.toISOString(),
          expiresAt: new Date(createdAt.getTime() + input.durationHours * 60 * 60 * 1000).toISOString(),
          maxRequests: input.maxRequests,
          maxRequestsPerMinute: input.maxRequestsPerMinute ?? DEFAULT_MAX_REQUESTS_PER_MINUTE,
          requestCount: 0
        };
        storeFile.leases.push(lease);
        await writeStoreFile(storeFile);
        const { accessTokenHash: _accessTokenHash, ...publicLease } = lease;
        return { ...publicLease, accessToken };
      });
    },
    async findLeaseByToken(hostedAgentId, accessToken): Promise<HostedAgentLeaseRecord | undefined> {
      const storeFile = await readStoreFile();
      const accessTokenHash = hashAccessToken(accessToken);
      return storeFile.leases.find(
        (item) => item.hostedAgentId === hostedAgentId && item.accessTokenHash === accessTokenHash
      );
    },
    async consumeLeaseRequest(leaseId): Promise<HostedAgentLeaseConsumptionResult> {
      return withMutation(async () => {
        const storeFile = await readStoreFile();
        const index = storeFile.leases.findIndex((item) => item.leaseId === leaseId);
        if (index === -1) return { status: "not_found" };

        const lease = storeFile.leases[index];
        if (lease.requestCount >= lease.maxRequests) {
          return { status: "quota_exceeded", lease };
        }

        const updated = {
          ...lease,
          requestCount: lease.requestCount + 1
        };
        storeFile.leases[index] = updated;
        await writeStoreFile(storeFile);
        return { status: "consumed", lease: updated };
      });
    },
    async incrementLeaseRequestCount(leaseId): Promise<HostedAgentLeaseRecord | undefined> {
      return withMutation(async () => {
        const storeFile = await readStoreFile();
        const index = storeFile.leases.findIndex((item) => item.leaseId === leaseId);
        if (index === -1) return undefined;
        storeFile.leases[index] = {
          ...storeFile.leases[index],
          requestCount: storeFile.leases[index].requestCount + 1
        };
        await writeStoreFile(storeFile);
        return storeFile.leases[index];
      });
    },
    async countRecentUsage(leaseId, since): Promise<number> {
      const storeFile = await readStoreFile();
      return storeFile.usage.filter(
        (item) =>
          item.leaseId === leaseId &&
          item.status !== "rejected" &&
          new Date(item.createdAt).getTime() >= since.getTime()
      ).length;
    },
    async recordUsage(log): Promise<HostedAgentUsageLog> {
      return withMutation(async () => {
        const storeFile = await readStoreFile();
        storeFile.usage.push(log);
        await writeStoreFile(storeFile);
        return log;
      });
    },
    async summarizeGateway(hostedAgentId): Promise<HostedAgentGatewaySummary> {
      const storeFile = await readStoreFile();
      const at = now();
      const usage = storeFile.usage.filter((item) => item.hostedAgentId === hostedAgentId);
      const latest = usage
        .map((item) => item.createdAt)
        .sort()
        .at(-1);

      return {
        secretConfigured: storeFile.secrets.some((item) => item.hostedAgentId === hostedAgentId),
        activeLeaseCount: storeFile.leases.filter(
          (item) => item.hostedAgentId === hostedAgentId && isLeaseActive(item, at)
        ).length,
        totalRequestCount: usage.length,
        failedRequestCount: usage.filter((item) => item.status !== "succeeded").length,
        ...(latest ? { latestRequestAt: latest } : {})
      };
    }
  };
}
