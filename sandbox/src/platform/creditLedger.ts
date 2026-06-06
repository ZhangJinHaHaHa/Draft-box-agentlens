export type PlatformCreditTransactionType = "grant" | "spend";
export type PlatformCreditSpendReason = "llm_recommendation";

export interface PlatformCreditAccount {
  userId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformCreditTransaction {
  transactionId: string;
  userId: string;
  type: PlatformCreditTransactionType;
  amount: number;
  balanceAfter: number;
  reason?: PlatformCreditSpendReason | "initial_grant" | "manual_grant";
  createdAt: string;
}

export function createCreditAccount(
  userId: string,
  initialCredits: number,
  at: string
): { account: PlatformCreditAccount; transaction?: PlatformCreditTransaction } {
  assertPositiveInteger(initialCredits, "initialCredits", true);

  const account: PlatformCreditAccount = {
    userId,
    balance: initialCredits,
    createdAt: at,
    updatedAt: at
  };

  if (initialCredits === 0) {
    return { account };
  }

  return {
    account,
    transaction: {
      transactionId: "credit-tx-initial",
      userId,
      type: "grant",
      amount: initialCredits,
      balanceAfter: initialCredits,
      reason: "initial_grant",
      createdAt: at
    }
  };
}

export function grantCredits(
  account: PlatformCreditAccount,
  input: {
    transactionId: string;
    amount: number;
    reason?: "manual_grant";
  },
  at: string
): { account: PlatformCreditAccount; transaction: PlatformCreditTransaction } {
  assertTransactionId(input.transactionId);
  assertPositiveInteger(input.amount, "amount");
  const nextBalance = account.balance + input.amount;

  return {
    account: {
      ...account,
      balance: nextBalance,
      updatedAt: at
    },
    transaction: {
      transactionId: input.transactionId,
      userId: account.userId,
      type: "grant",
      amount: input.amount,
      balanceAfter: nextBalance,
      reason: input.reason ?? "manual_grant",
      createdAt: at
    }
  };
}

export function spendCredits(
  account: PlatformCreditAccount,
  input: {
    transactionId: string;
    amount: number;
    reason: PlatformCreditSpendReason;
  },
  at: string
): { account: PlatformCreditAccount; transaction: PlatformCreditTransaction } {
  assertTransactionId(input.transactionId);
  assertPositiveInteger(input.amount, "amount");

  if (account.balance < input.amount) {
    throw new Error(`Insufficient platform credits: need ${input.amount}, have ${account.balance}.`);
  }

  const nextBalance = account.balance - input.amount;
  return {
    account: {
      ...account,
      balance: nextBalance,
      updatedAt: at
    },
    transaction: {
      transactionId: input.transactionId,
      userId: account.userId,
      type: "spend",
      amount: input.amount,
      balanceAfter: nextBalance,
      reason: input.reason,
      createdAt: at
    }
  };
}

export function assertPositiveInteger(
  value: number,
  fieldName: string,
  allowZero = false
): void {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${fieldName} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
}

function assertTransactionId(transactionId: string): void {
  if (transactionId.trim().length === 0) {
    throw new Error("transactionId is required.");
  }
}
