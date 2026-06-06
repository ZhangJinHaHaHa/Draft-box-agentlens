import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  HostedAgentApproval,
  HostedAgentCreateInput,
  HostedAgentDraft,
  HostedAgentReviewSubmission
} from "./hostedAgentTypes";

export interface HostedAgentStore {
  readonly stateDir: string;
  createHostedAgent(input: HostedAgentCreateInput): Promise<HostedAgentDraft>;
  listHostedAgents(): Promise<HostedAgentDraft[]>;
  findHostedAgentById(hostedAgentId: string): Promise<HostedAgentDraft | undefined>;
  submitHostedAgentForReview(
    hostedAgentId: string,
    review: HostedAgentReviewSubmission
  ): Promise<HostedAgentDraft | undefined>;
  approveHostedAgent(
    hostedAgentId: string,
    approval: HostedAgentApproval
  ): Promise<HostedAgentDraft | undefined>;
}

export interface HostedAgentStoreOptions {
  stateDir: string;
  now?: () => Date;
  createHostedAgentId?: () => string;
}

interface HostedAgentStoreFile {
  items: HostedAgentDraft[];
  updatedAt: string;
}

type HostedAgentEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

const HOSTED_AGENTS_FILE_NAME = "hosted-agents.json";

export function resolveDefaultHostedAgentStateDir(cwd: string = process.cwd()): string {
  return join(cwd, ".runtime", "hosted-agents");
}

export function resolveHostedAgentStateDir(stateDir?: string, cwd?: string): string {
  return stateDir ?? resolveDefaultHostedAgentStateDir(cwd);
}

export function resolveHostedAgentStateDirFromEnv(env: HostedAgentEnv, cwd?: string): string {
  return resolveHostedAgentStateDir(env.HOSTED_AGENT_STATE_DIR, cwd);
}

export function createHostedAgentStore(options: HostedAgentStoreOptions): HostedAgentStore {
  const now = options.now ?? (() => new Date());
  const createHostedAgentId =
    options.createHostedAgentId ??
    (() => `hst-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`);
  const filePath = join(options.stateDir, HOSTED_AGENTS_FILE_NAME);

  async function ensureDirectory(): Promise<void> {
    await mkdir(options.stateDir, { recursive: true });
  }

  async function readStoreFile(): Promise<HostedAgentStoreFile | undefined> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as HostedAgentStoreFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  async function writeStoreFile(items: HostedAgentDraft[]): Promise<void> {
    await ensureDirectory();
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(
      tempPath,
      JSON.stringify(
        {
          items,
          updatedAt: now().toISOString()
        } satisfies HostedAgentStoreFile,
        null,
        2
      ),
      "utf8"
    );
    await rename(tempPath, filePath);
  }

  return {
    stateDir: options.stateDir,
    async createHostedAgent(input): Promise<HostedAgentDraft> {
      const timestamp = now().toISOString();
      const draft: HostedAgentDraft = {
        hostedAgentId: createHostedAgentId(),
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input
      };
      const items = (await readStoreFile())?.items ?? [];
      items.push(draft);
      await writeStoreFile(items);
      return draft;
    },
    async listHostedAgents(): Promise<HostedAgentDraft[]> {
      return (await readStoreFile())?.items ?? [];
    },
    async findHostedAgentById(hostedAgentId): Promise<HostedAgentDraft | undefined> {
      const items = await this.listHostedAgents();
      return items.find((item) => item.hostedAgentId === hostedAgentId);
    },
    async submitHostedAgentForReview(hostedAgentId, review): Promise<HostedAgentDraft | undefined> {
      const items = (await readStoreFile())?.items ?? [];
      const index = items.findIndex((item) => item.hostedAgentId === hostedAgentId);

      if (index === -1) {
        return undefined;
      }

      const updated: HostedAgentDraft = {
        ...items[index],
        status: "pending_review",
        updatedAt: now().toISOString(),
        review
      };
      items[index] = updated;
      await writeStoreFile(items);
      return updated;
    },
    async approveHostedAgent(hostedAgentId, approval): Promise<HostedAgentDraft | undefined> {
      const items = (await readStoreFile())?.items ?? [];
      const index = items.findIndex((item) => item.hostedAgentId === hostedAgentId);

      if (index === -1) {
        return undefined;
      }

      const updated: HostedAgentDraft = {
        ...items[index],
        status: "approved",
        updatedAt: now().toISOString(),
        approval
      };
      items[index] = updated;
      await writeStoreFile(items);
      return updated;
    }
  };
}
