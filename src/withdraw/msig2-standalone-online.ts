import { getPublicKey } from "everscale-crypto";
import * as nekoton from "nekoton-wasm";

import { ToncenterClient } from "../toncenter/client";
import {
  getInMessage,
  getMessageBody,
  getMessageDestination,
  getOutMessages,
} from "../toncenter/normalize";
import type { ToncenterTransaction } from "../toncenter/types";
import {
  makeMsig2ConfirmCall,
  makeMsig2WithdrawCall,
  MSIG2_ABI,
  type Msig2Call,
  type Msig2ConfirmParams,
  type Msig2Method,
  type Msig2SignerParams,
  type Msig2WalletWithdrawParams,
} from "./msig2-standalone-offline";
import { createStandaloneProvider } from "./standalone-provider";
import {
  readAbiV2SignedExternalMessageExpireAt,
  waitForToncenterExternalBocSubmission,
} from "./toncenter-external-boc";

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

export type Msig2Confirmation = "executed" | "confirmed";

export type ParsedMsig2ExternalBoc = {
  wallet: string;
  messageHash: string;
  expireAt: number;
  input: Record<string, unknown>;
};

export type Msig2WalletDirectParams = Omit<Msig2WalletWithdrawParams, "signatureId">;
export type Msig2ConfirmDirectParams = Omit<Msig2ConfirmParams, "signatureId">;

export async function sendMsig2WalletDirect(
  params: Msig2WalletDirectParams & { rpcEndpoint: string },
) {
  return sendMsig2Direct(params, makeMsig2WithdrawCall(params));
}

export async function confirmMsig2TransactionDirect(
  params: Msig2ConfirmDirectParams & { rpcEndpoint: string },
) {
  return sendMsig2Direct(params, makeMsig2ConfirmCall(params));
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

export function msig2ConfirmationOutcome(transaction: ToncenterTransaction): Msig2Confirmation {
  return hasInternalTransfer(transaction) ? "executed" : "confirmed";
}

/**
 * Reads the destination, hash, and signed expiration from an external BOC,
 * without a network request. The ABI check prevents a sender from broadcasting
 * another type of message by mistake.
 */
export function parseMsig2ExternalBoc(boc: string, method: Msig2Method): ParsedMsig2ExternalBoc {
  const message = nekoton.parseMessageBase64Extended(boc);
  if (message.msgType !== "ExtIn" || !message.dst || !message.body) {
    throw new Error("--boc must be a signed external multisig2 message with a destination and body");
  }

  let input: Record<string, unknown>;
  try {
    const decoded = nekoton.decodeInput(message.body, MSIG2_ABI, method, false);
    if (!decoded) throw new Error("not decoded");
    input = decoded.input as Record<string, unknown>;
  } catch {
    throw new Error(`--boc is not a multisig2 ${method} external message`);
  }

  return {
    wallet: message.dst,
    messageHash: message.hash,
    expireAt: readMsig2ExternalMessageExpireAt(message.body),
    input,
  };
}

export async function waitForToncenterMsig2Submission(
  client: ToncenterClient,
  wallet: string,
  messageHash: string,
  expireAt: number,
  method: Msig2Method,
): Promise<ToncenterMsig2Submission> {
  const submission = await waitForToncenterExternalBocSubmission(client, {
    wallet,
    messageHash,
    expireAt,
  });
  return {
    transaction: submission.transaction,
    output: submission.transaction ? decodeMsig2Output(submission.transaction, method) : undefined,
  };
}

function readMsig2ExternalMessageExpireAt(body: string): number {
  try {
    return readAbiV2SignedExternalMessageExpireAt(body);
  } catch {
    throw new Error("--boc has an unsupported multisig2 signed external-message body");
  }
}

async function sendMsig2Direct(
  params: Omit<Msig2SignerParams, "signatureId"> & { rpcEndpoint: string },
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

function decodeMsig2Output(
  transaction: ToncenterTransaction,
  method: Msig2Method,
): Record<string, unknown> | undefined {
  for (const message of getOutMessages(transaction)) {
    const body = getMessageBody(message);
    if (!body) continue;
    const decoded = nekoton.decodeOutput(body, MSIG2_ABI, method);
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
    return nekoton.decodeInput(body, MSIG2_ABI, method, false)?.input as Record<string, unknown> | undefined;
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
