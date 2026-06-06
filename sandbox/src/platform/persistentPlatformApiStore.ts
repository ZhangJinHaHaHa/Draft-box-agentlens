import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  InMemoryPlatformApiStore,
  type PlatformApiStoreState
} from "./platformApiStore";

export interface PersistentPlatformApiStoreOptions {
  stateDir: string;
  now?: () => string;
  initialPlatformCredits?: number;
}

interface PlatformApiStoreFile {
  state: PlatformApiStoreState;
  updatedAt: string;
}

const PLATFORM_STATE_FILE_NAME = "platform-state.json";

export function resolveDefaultPlatformApiStateDir(cwd: string = process.cwd()): string {
  return join(cwd, ".runtime", "platform-api");
}

export function resolvePlatformApiStateDir(stateDir?: string, cwd?: string): string {
  return stateDir ?? resolveDefaultPlatformApiStateDir(cwd);
}

export function createPersistentPlatformApiStore(
  options: PersistentPlatformApiStoreOptions
): InMemoryPlatformApiStore {
  const stateFilePath = join(options.stateDir, PLATFORM_STATE_FILE_NAME);
  const now = options.now ?? (() => new Date().toISOString());
  const initialState = readStoreState(stateFilePath);

  return new InMemoryPlatformApiStore(
    now,
    options.initialPlatformCredits,
    initialState,
    (state) => writeStoreState(options.stateDir, stateFilePath, state, now())
  );
}

function readStoreState(stateFilePath: string): PlatformApiStoreState | undefined {
  if (!existsSync(stateFilePath)) {
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(stateFilePath, "utf8")) as PlatformApiStoreFile;
  return parsed.state;
}

function writeStoreState(
  stateDir: string,
  stateFilePath: string,
  state: PlatformApiStoreState,
  updatedAt: string
): void {
  mkdirSync(stateDir, { recursive: true });
  const tempPath = `${stateFilePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(
    tempPath,
    JSON.stringify(
      {
        state,
        updatedAt
      } satisfies PlatformApiStoreFile,
      null,
      2
    ),
    "utf8"
  );
  renameSync(tempPath, stateFilePath);
}
