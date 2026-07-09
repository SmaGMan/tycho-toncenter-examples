import { getPublicKey } from "everscale-crypto";

import core from "everscale-standalone-client/core";
import { ToncenterClient } from "../toncenter/client";
import {
  getInMessage,
  getMessageBody,
  getMessageDestination,
  getOutMessages,
} from "../toncenter/normalize";
import type { ToncenterTransaction } from "../toncenter/types";
import { makeCommentPayload } from "./payload";
import { createStandaloneProvider } from "./standalone-provider";

type Msig2SignerParams = {
  wallet: string;
  secretKey: string;
  timeout?: number;
  signatureId?: number;
  publicKey?: string;
};

export type Msig2WalletWithdrawParams = Msig2SignerParams & {
  recipient: string;
  amountNano: string;
  bounce: boolean;
  comment?: string;
};

export type Msig2ConfirmParams = Msig2SignerParams & {
  transactionId: string;
};

type Msig2Method = "submitTransaction" | "confirmTransaction";

type Msig2Call = {
  method: Msig2Method;
  params: Record<string, string | number | boolean | null>;
};

export type BuiltMsigWalletBoc = {
  boc: string;
  hash: string;
  expireAt: number;
  publicKey: string;
};

export type Msig2PendingTransaction = {
  id: string;
  confirmationsMask: string;
  signsRequired: string;
  signsReceived: string;
  creator: string;
  index: string;
  dest: string;
  value: string;
  sendFlags: string;
  payload: string;
  bounce: boolean;
  stateInit: string | null;
};

export type ToncenterMsig2Submission = {
  transaction?: ToncenterTransaction;
  output?: Record<string, unknown>;
};

export type ToncenterMsig2PendingTransaction = {
  transactionId: string;
  transaction: ToncenterTransaction;
  output: Record<string, unknown>;
};

export type Msig2ConfirmationStatus = "executed" | "confirmed" | "not_observed";

export async function sendMsig2WalletDirect(params: Msig2WalletWithdrawParams & { rpcEndpoint: string }) {
  return sendMsig2Direct(params, withdrawCall(params));
}

export async function confirmMsig2TransactionDirect(params: Msig2ConfirmParams & { rpcEndpoint: string }) {
  return sendMsig2Direct(params, confirmCall(params));
}

export async function getMsig2PendingTransactions(params: { wallet: string; rpcEndpoint: string }) {
  const provider = await createStandaloneProvider(params.rpcEndpoint);
  const result = await provider.rawApi.runLocal({
    address: params.wallet,
    functionCall: {
      abi: MSIG2_ABI,
      method: "getTransactions",
      params: {},
    },
  });
  const transactions = Array.isArray(result.output?.transactions)
    ? (result.output.transactions as Msig2PendingTransaction[])
    : [];

  return transactions;
}

export async function getMsig2PendingTransactionsViaToncenter(
  client: ToncenterClient,
  wallet: string,
  limit = 50,
): Promise<ToncenterMsig2PendingTransaction[]> {
  await core.ensureNekotonLoaded();
  const { transactions = [] } = await client.transactionsByAccount(wallet, limit);
  const submissions = new Map<string, ToncenterMsig2PendingTransaction>();
  const completed = new Set<string>();

  for (const transaction of transactions) {
    const output = decodeMsig2Output(transaction, "submitTransaction");
    const transactionId = tokenString(output?.transId);
    if (output && transactionId) {
      submissions.set(transactionId, { transactionId, transaction, output });
      if (hasInternalTransfer(transaction)) completed.add(transactionId);
    }

    const confirmation = decodeMsig2Input(transaction, "confirmTransaction");
    const confirmedTransactionId = tokenString(confirmation?.transactionId);
    if (confirmedTransactionId && hasInternalTransfer(transaction)) {
      completed.add(confirmedTransactionId);
    }
  }

  return [...submissions.values()].filter(({ transactionId }) => !completed.has(transactionId));
}

export function msig2ConfirmationStatus(transaction: unknown): Msig2ConfirmationStatus {
  if (!transaction || typeof transaction !== "object") return "not_observed";
  const executed = getOutMessages(transaction as ToncenterTransaction)
    .some(message => getMessageDestination(message) != null);
  return executed ? "executed" : "confirmed";
}

export async function buildMsig2WalletBoc(params: Msig2WalletWithdrawParams): Promise<BuiltMsigWalletBoc> {
  return buildMsig2Boc(params, withdrawCall(params));
}

export async function buildMsig2ConfirmBoc(params: Msig2ConfirmParams): Promise<BuiltMsigWalletBoc> {
  return buildMsig2Boc(params, confirmCall(params));
}

export async function sendMsig2WalletBocViaToncenter(
  client: ToncenterClient,
  params: Msig2WalletWithdrawParams,
) {
  return sendMsig2BocViaToncenter(client, params, withdrawCall(params));
}

export async function sendMsig2ConfirmBocViaToncenter(
  client: ToncenterClient,
  params: Msig2ConfirmParams,
) {
  return sendMsig2BocViaToncenter(client, params, confirmCall(params));
}

function withdrawCall(params: Msig2WalletWithdrawParams): Msig2Call {
  return {
    method: "submitTransaction",
    params: {
      dest: params.recipient,
      value: params.amountNano,
      bounce: params.bounce,
      allBalance: false,
      payload: params.comment ? makeCommentPayload(params.comment) : "",
      stateInit: null,
    },
  };
}

function confirmCall(params: Msig2ConfirmParams): Msig2Call {
  return {
    method: "confirmTransaction",
    params: { transactionId: params.transactionId },
  };
}

async function sendMsig2Direct(
  params: Msig2SignerParams & { rpcEndpoint: string },
  call: Msig2Call,
) {
  const publicKey = params.publicKey ?? getPublicKey(params.secretKey);
  const provider = await createStandaloneProvider(params.rpcEndpoint, {
    signer: { publicKey, secretKey: params.secretKey },
    message: { timeout: params.timeout ?? 30, retryCount: 1 },
  });
  await assertMsig2Custodian(provider, params.wallet, publicKey);

  return provider.rawApi.sendExternalMessage({
    publicKey,
    recipient: params.wallet,
    payload: { abi: MSIG2_ABI, ...call },
  });
}

async function buildMsig2Boc(params: Msig2SignerParams, call: Msig2Call): Promise<BuiltMsigWalletBoc> {
  await core.ensureNekotonLoaded();
  const nekoton = core.nekoton;
  const publicKey = params.publicKey ?? getPublicKey(params.secretKey);
  const unsigned = nekoton.createExternalMessage(
    new nekoton.ClockWithOffset(),
    params.wallet,
    MSIG2_ABI,
    call.method,
    undefined,
    call.params,
    publicKey,
    params.timeout ?? 60,
  );

  try {
    const signature = nekoton.ed25519_sign(params.secretKey, unsigned.hash, params.signatureId);
    const signed = unsigned.sign(signature);
    return {
      boc: signed.boc,
      hash: signed.hash,
      expireAt: signed.expireAt,
      publicKey,
    };
  } finally {
    unsigned.free();
  }
}

async function sendMsig2BocViaToncenter(
  client: ToncenterClient,
  params: Msig2SignerParams,
  call: Msig2Call,
) {
  const message = await buildMsig2Boc(params, call);
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForToncenterMsig2Submission(
    client,
    params.wallet,
    message.hash,
    message.expireAt,
    call.method,
  );
  return { message, result, ...submission };
}

export async function waitForToncenterMsig2Submission(
  client: ToncenterClient,
  wallet: string,
  messageHash: string,
  expireAt: number,
  method: Msig2Method,
): Promise<ToncenterMsig2Submission> {
  await core.ensureNekotonLoaded();
  const toncenterHash = Buffer.from(messageHash, "hex").toString("base64");
  const deadline = Math.max(Date.now() + 5_000, expireAt * 1000 + 5_000);

  while (Date.now() < deadline) {
    const { transactions = [] } = await client.transactionsByAccount(wallet);
    const transaction = transactions.find(item => getInMessage(item)?.hash === toncenterHash);
    if (transaction) {
      return {
        transaction,
        output: decodeMsig2Output(transaction, method),
      };
    }
    await delay(1_000);
  }

  return {};
}

function decodeMsig2Output(
  transaction: ToncenterTransaction,
  method: Msig2Method,
): Record<string, unknown> | undefined {
  for (const message of getOutMessages(transaction)) {
    const body = getMessageBody(message);
    if (!body) continue;
    const decoded = core.nekoton.decodeOutput(body, MSIG2_ABI, method);
    if (decoded) return decoded.output as Record<string, unknown>;
  }

  return undefined;
}

function decodeMsig2Input(
  transaction: ToncenterTransaction,
  method: "confirmTransaction",
): Record<string, unknown> | undefined {
  const body = getMessageBody(getInMessage(transaction));
  if (!body) return undefined;

  try {
    return core.nekoton.decodeInput(body, MSIG2_ABI, method, false)?.input as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
}

function hasInternalTransfer(transaction: ToncenterTransaction): boolean {
  return getOutMessages(transaction).some(message => getMessageDestination(message) != null);
}

function tokenString(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertMsig2Custodian(
  provider: Awaited<ReturnType<typeof createStandaloneProvider>>,
  wallet: string,
  publicKey: string,
) {
  const result = await provider.rawApi.runLocal({
    address: wallet,
    functionCall: {
      abi: MSIG2_ABI,
      method: "getCustodians",
      params: {},
    },
  });
  const custodians = Array.isArray(result.output?.custodians)
    ? (result.output.custodians as Array<{ pubkey: string }>)
    : [];
  const isCustodian = custodians.some(
    (custodian) => BigInt(custodian.pubkey).toString(16).padStart(64, "0") === publicKey,
  );

  if (!isCustodian) {
    throw new Error(`public key ${publicKey} is not a custodian of ${wallet}`);
  }
}

const MSIG2_ABI = `{
  "ABI version": 2,
  "version": "2.3",
  "header": ["pubkey", "time", "expire"],
  "functions": [{
    "name": "submitTransaction",
    "inputs": [
      {"name":"dest","type":"address"},
      {"name":"value","type":"uint128"},
      {"name":"bounce","type":"bool"},
      {"name":"allBalance","type":"bool"},
      {"name":"payload","type":"cell"},
      {"name":"stateInit","type":"optional(cell)"}
    ],
    "outputs": [
      {"name":"transId","type":"uint64"}
    ]
  }, {
    "name": "confirmTransaction",
    "inputs": [
      {"name":"transactionId","type":"uint64"}
    ],
    "outputs": []
  }, {
    "name": "getCustodians",
    "inputs": [],
    "outputs": [{
      "name":"custodians",
      "type":"tuple[]",
      "components":[
        {"name":"index","type":"uint8"},
        {"name":"pubkey","type":"uint256"}
      ]
    }]
  }, {
    "name": "getTransactions",
    "inputs": [],
    "outputs": [{
      "name":"transactions",
      "type":"tuple[]",
      "components":[
        {"name":"id","type":"uint64"},
        {"name":"confirmationsMask","type":"uint32"},
        {"name":"signsRequired","type":"uint8"},
        {"name":"signsReceived","type":"uint8"},
        {"name":"creator","type":"uint256"},
        {"name":"index","type":"uint8"},
        {"name":"dest","type":"address"},
        {"name":"value","type":"uint128"},
        {"name":"sendFlags","type":"uint16"},
        {"name":"payload","type":"cell"},
        {"name":"bounce","type":"bool"},
        {"name":"stateInit","type":"optional(cell)"}
      ]
    }]
  }],
  "events": []
}`;
