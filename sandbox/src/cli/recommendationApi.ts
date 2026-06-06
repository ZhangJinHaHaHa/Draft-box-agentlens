import { createRecommendationApiServer } from "../recommendation/recommendationApiServer";
import {
  readRecommendationApiConfig,
  type RecommendationApiConfig
} from "../recommendation/readRecommendationApiConfig";

interface RecommendationApiServerLike {
  once(event: string, handler: (...args: unknown[]) => void): unknown;
  listen(port: number, host: string, callback: () => void): unknown;
}

export interface RecommendationApiCliDependencies {
  createServer?: (config: RecommendationApiConfig) => RecommendationApiServerLike;
  writeStdout?: (line: string) => void;
}

export async function runRecommendationApiCli(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  dependencies: RecommendationApiCliDependencies = {}
): Promise<void> {
  const config = readRecommendationApiConfig(env);
  const server = (dependencies.createServer ?? createRecommendationApiServer)(config);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      resolve();
    });
  });

  writeStdout(
    `${JSON.stringify({
      type: "recommendation-api-listening",
      host: config.host,
      port: config.port,
      catalogPath: config.catalogPath ?? "default"
    })}\n`
  );
}

if (require.main === module) {
  void runRecommendationApiCli(process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
