import { createPlatformApiServer } from "../platform/platformApiServer";
import { readPlatformApiConfig, type PlatformApiConfig } from "../platform/readPlatformApiConfig";

interface PlatformApiServerLike {
  once(event: string, handler: (...args: unknown[]) => void): unknown;
  listen(port: number, host: string, callback: () => void): unknown;
}

export interface PlatformApiCliDependencies {
  createServer?: (config: PlatformApiConfig) => PlatformApiServerLike;
  writeStdout?: (line: string) => void;
}

export async function runPlatformApiCli(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  dependencies: PlatformApiCliDependencies = {}
): Promise<void> {
  const config = readPlatformApiConfig(env);
  const server = (dependencies.createServer ?? createPlatformApiServer)(config);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      resolve();
    });
  });

  writeStdout(
    `${JSON.stringify({
      type: "platform-api-listening",
      host: config.host,
      port: config.port
    })}\n`
  );
}

if (require.main === module) {
  void runPlatformApiCli(process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
