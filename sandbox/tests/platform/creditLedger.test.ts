import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreditAccount,
  grantCredits,
  spendCredits
} from "../../src/platform/creditLedger";

test("createCreditAccount grants an initial balance", () => {
  const { account, transaction } = createCreditAccount(
    "user-1",
    100,
    "2026-06-05T00:00:00.000Z"
  );

  assert.equal(account.balance, 100);
  assert.equal(transaction?.type, "grant");
  assert.equal(transaction?.balanceAfter, 100);
});

test("grantCredits increases balance", () => {
  const { account } = createCreditAccount("user-1", 0, "2026-06-05T00:00:00.000Z");
  const granted = grantCredits(
    account,
    { transactionId: "credit-tx-1", amount: 20 },
    "2026-06-05T00:01:00.000Z"
  );

  assert.equal(granted.account.balance, 20);
  assert.equal(granted.transaction.reason, "manual_grant");
});

test("spendCredits decreases balance and rejects overdraft", () => {
  const { account } = createCreditAccount("user-1", 10, "2026-06-05T00:00:00.000Z");
  const spent = spendCredits(
    account,
    { transactionId: "credit-tx-1", amount: 3, reason: "llm_recommendation" },
    "2026-06-05T00:01:00.000Z"
  );

  assert.equal(spent.account.balance, 7);
  assert.equal(spent.transaction.type, "spend");

  assert.throws(
    () =>
      spendCredits(
        spent.account,
        { transactionId: "credit-tx-2", amount: 8, reason: "llm_recommendation" },
        "2026-06-05T00:02:00.000Z"
      ),
    /Insufficient platform credits/
  );
});
