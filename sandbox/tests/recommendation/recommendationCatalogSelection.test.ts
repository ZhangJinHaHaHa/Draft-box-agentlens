import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRecommendationCatalog,
  recommendationSelectionGroups
} from "../../src/recommendation/defaultRecommendationCatalog";
import { recommendFromCatalog } from "../../src/recommendation/recommendationService";

const catalogIds = new Set(defaultRecommendationCatalog.map((entry) => entry.id));

test("default recommendation catalog includes marketplace expert agents", () => {
  assert.ok(catalogIds.has("expert-criminal-defense"));
  assert.ok(catalogIds.has("expert-tax-planning"));
  assert.ok(catalogIds.has("expert-venture-dd"));
  assert.ok(catalogIds.has("expert-content-ops"));
});

test("backend recommendation selection groups contain two to four real competitors", () => {
  for (const group of recommendationSelectionGroups) {
    assert.ok(
      group.agentIds.length >= 2 && group.agentIds.length <= 4,
      `${group.id} should contain 2-4 competitors, got ${group.agentIds.length}`
    );
    assert.equal(new Set(group.agentIds).size, group.agentIds.length, `${group.id} contains duplicate ids`);

    for (const agentId of group.agentIds) {
      assert.ok(catalogIds.has(agentId), `${group.id} references missing catalog id: ${agentId}`);
    }
  }
});

test("professional-domain requests can surface marketplace competitors", () => {
  const response = recommendFromCatalog(defaultRecommendationCatalog, {
    query: "刑事辩护 案卷 律师 法律意见",
    limit: 4
  });
  const ids = response.results.map((result) => result.agentId);

  assert.ok(ids.includes("expert-criminal-defense"));
  assert.ok(ids.includes("harvey"));
});
