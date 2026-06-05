import assert from "node:assert/strict";
import test from "node:test";

import { defaultRecommendationCatalog } from "../../src/recommendation/defaultRecommendationCatalog";
import { handleRecommendationApiRequest } from "../../src/recommendation/recommendationApiServer";

class MockRequest implements AsyncIterable<Buffer> {
  constructor(
    public method: string,
    public url: string,
    private body: unknown = undefined
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<Buffer> {
    if (this.body !== undefined) {
      yield Buffer.from(JSON.stringify(this.body));
    }
  }
}

class MockResponse {
  statusCode = 0;
  headers = new Map<string, string>();
  body = "";

  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  end(body: string): void {
    this.body = body;
  }
}

test("handleRecommendationApiRequest returns health", async () => {
  const response = new MockResponse();

  await handleRecommendationApiRequest(
    new MockRequest("GET", "/health"),
    response,
    defaultRecommendationCatalog
  );

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).catalogSize, defaultRecommendationCatalog.length);
});

test("handleRecommendationApiRequest returns recommendations", async () => {
  const response = new MockResponse();

  await handleRecommendationApiRequest(
    new MockRequest("POST", "/api/recommendations", {
      query: "自托管 RAG 知识库 API",
      priorities: ["self-host"],
      limit: 2
    }),
    response,
    defaultRecommendationCatalog
  );

  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    payload.results.map((result: { agentId: string }) => result.agentId),
    ["dify", "flowise"]
  );
});

test("handleRecommendationApiRequest rejects missing query", async () => {
  const response = new MockResponse();

  await handleRecommendationApiRequest(
    new MockRequest("POST", "/api/recommendations", {}),
    response,
    defaultRecommendationCatalog
  );

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /query is required/);
});
