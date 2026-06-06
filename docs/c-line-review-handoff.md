# C 线 PR 审阅与合并交接

PR: https://github.com/ZhangJinHaHaHa/Draft-box-agentlens/pull/1

分支: `codex/c-platform-recommendation-foundation`

当前状态: Draft, 但代码和验证已经按 review-ready 整理。若团队决定合并，需要先在 GitHub 上把 PR 从 Draft 转为 Ready for review。

## C 线本次交付范围

这条线主要负责平台中间层能力，不改主业务 UI 风格，不改合约，不抢其他线的审计/链上实现。

已完成的 MVP 能力:

- 推荐 API 基础: 规则推荐、LLM rerank、fallback、可解释推荐结果。
- 平台积分: 付费 LLM 推荐会扣用户平台积分，LLM 失败 fallback 不扣分。
- Web2 用户入口: Google mock 登录创建平台用户、托管钱包和初始积分。
- 托管钱包: 支持可导出状态机和迁移到外部钱包，API 不返回私钥材料。
- 订单支付: 创建订单、mock payment callback、幂等支付回调。
- Web2 访问权桥接: 订单 paid 后创建 access bridge，模拟 operator wallet 写链上访问权。
- 退款规则: 区分安全事件、访问失败、核心能力不足、设计不匹配等退款路径。
- 结算与 holdback: paid order 生成开发者结算，退款 review 时冻结/回滚结算。
- 开发者/Agent 本地声誉: 聚合订单、访问权、退款、评分等平台信号。
- 使用后评分闭环: 付费且访问权确认后才能评分，一个订单只能评一次；评分会回灌声誉和推荐信号。
- 独立 C 线 demo 页: `frontend/public/c-line-demo.html`，不依赖主 React 页面和前端 env。

## 建议队友重点审阅的文件

- `sandbox/src/platform/platformApiServer.ts`
  - C 线 Platform API 路由。
  - 推荐调用前会把真实本地平台信号注入 catalog 副本，不改原 catalog 文件。

- `sandbox/src/platform/platformApiStore.ts`
  - Web2 用户、积分、订单、支付、访问权、退款、结算、开发者、评分的内存状态机。

- `sandbox/src/platform/usageReview.ts`
  - 使用后评分模型和聚合逻辑。
  - 评分包含 `overallRating` 和 6 维 `0/1/2` 映射，便于后续对接 `AgentReviewRegistry`。

- `sandbox/src/platform/reputationRead.ts`
  - 本地声誉快照。
  - 评分、退款、访问权确认会影响 reputation signals。

- `sandbox/tests/platform/platformApiServer.test.ts`
  - API 级测试，覆盖评分前置条件、重复评分、推荐信号回灌。

- `sandbox/tests/platform/persistentPlatformApiStore.test.ts`
  - 持久化测试，覆盖使用后评分 reload。

- `frontend/public/c-line-demo.html`
  - C 线独立验证页。
  - 展示推荐、积分、订单、访问权、评分、钱包迁移、退款、结算。

## 本地运行方式

先启动 Platform API。mock LLM 模式不需要任何密钥:

```bash
PLATFORM_RECOMMENDATION_LLM_PROVIDER=mock npm run run:platform:api --prefix sandbox
```

如需接真实 LLM，使用环境变量注入，不要提交到仓库:

```bash
PLATFORM_RECOMMENDATION_LLM_PROVIDER=openai \
PLATFORM_RECOMMENDATION_LLM_API_BASE_URL=<team-relay-base-url>/v1 \
PLATFORM_RECOMMENDATION_LLM_MODEL=<model-name> \
PLATFORM_RECOMMENDATION_LLM_API_KEY=<secret> \
npm run run:platform:api --prefix sandbox
```

再启动前端:

```bash
npm run dev --prefix frontend
```

打开独立 demo 页:

```text
http://127.0.0.1:5173/c-line-demo.html
```

建议点击顺序:

1. `检查 API`
2. `创建 Google Mock 用户`
3. `付费 LLM 推荐一次`
4. `跑购买 + 访问权桥接`
5. `跑使用后评分`
6. `跑钱包导出 + 迁移`
7. `跑退款规则对比`

也可以直接点击 `跑完整 C 线流程`。

## 评分闭环设计

提交评分接口:

```http
POST /api/reviews
```

关键规则:

- 订单必须是 `paid`。
- 对应 access bridge 必须是 `confirmed`。
- `orderId + userId` 必须匹配。
- 一个订单只能提交一次使用后评分。
- 评分记录会生成 `commentHash`，保留后续上链空间。

评分结果会影响:

- `GET /api/reviews/agents/:agentId/summary`
- `GET /api/reputation/agents/:agentId`
- `POST /api/recommendations/llm` 推荐前的动态平台信号

## 已验证

本地已通过:

```bash
npm run build --prefix sandbox
npm test --prefix sandbox -- platform/platformApiServer.test.ts platform/persistentPlatformApiStore.test.ts
npm run build --prefix frontend
```

实际 `sandbox` 测试命令跑到了全量 Node 测试，结果为 `755 passed`。

真实 HTTP smoke 也已通过:

- 使用后评分返回 `201`。
- 同一订单重复评分返回 `409`。
- Agent review summary 中 `platformRating=100`。
- 推荐接口仍正常扣积分，用户余额从 `100` 到 `97`。
- Top recommendation 为 `dify`。

## 当前边界

本 PR 没有做:

- 主 React 页面最终样式接入。
- 真实 Google OAuth。
- 真实支付服务商。
- 真实 operator wallet 链上写交易。
- 合约变更。
- 私钥导出材料返回。

这些边界是刻意保留的，避免和其他线冲突。

## 合并建议

建议队友按下面顺序审:

1. 先跑测试，看平台状态机是否稳定。
2. 再打开 `c-line-demo.html`，确认黑客松演示闭环是否清楚。
3. 最后看 API 边界是否和 A/B 线需要的接口一致。

如果团队认可 C 线作为平台中间层 MVP，可以把 PR 从 Draft 转为 Ready for review 后合并。合并前建议确认:

- A 线是否需要主前端直接调用 `POST /api/recommendations/llm`。
- B/链上线是否要把 `commentHash` 和 6 维评分写入 `AgentReviewRegistry`。
- operator wallet 写链上访问权的真实交易由哪条线最终接入。
