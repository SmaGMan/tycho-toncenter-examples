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
  resolveMultisigPublicKey,
  type MultisigCall,
  type MultisigContractSpec,
  type MultisigSignerParams,
} from "./multisig-standalone-offline";
import { createStandaloneProvider } from "./standalone-provider";
import {
  readAbiV2SignedExternalMessageExpireAt,
  waitForToncenterExternalBocSubmission,
} from "./toncenter-external-boc";

export type MultisigPendingTransaction = {
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
  stateInit?: string | null;
};

export type ToncenterMultisigSubmission = {
  transaction?: ToncenterTransaction;
  output?: Record<string, unknown>;
};

export type ToncenterMultisigPendingTransaction = {
  transactionId: string;
  transaction: ToncenterTransaction;
  output: Record<string, unknown>;
};

export type MultisigConfirmation = "executed" | "confirmed";

export type ParsedMultisigExternalBoc = {
  wallet: string;
  messageHash: string;
  expireAt: number;
  input: Record<string, unknown>;
};

export async function sendMultisigDirect(
  spec: MultisigContractSpec,
  params: Omit<MultisigSignerParams, "signatureId"> & { rpcEndpoint: string },
  call: MultisigCall,
) {
  const publicKey = resolveMultisigPublicKey(params);
  const provider = await createStandaloneProvider(params.rpcEndpoint, {
    signer: { publicKey, secretKey: params.secretKey },
    message: { timeout: params.timeout ?? 30, retryCount: 1 },
  });
  await assertMultisigCustodian(spec, provider, params.wallet, publicKey);

  return provider.rawApi.sendExternalMessage({
    publicKey,
    recipient: params.wallet,
    payload: { abi: spec.abi, ...call },
  });
}

export async function getMultisigPendingTransactions<T extends MultisigPendingTransaction>(
  spec: MultisigContractSpec,
  params: { wallet: string; rpcEndpoint: string },
): Promise<T[]> {
  const provider = await createStandaloneProvider(params.rpcEndpoint);
  const result = await provider.rawApi.runLocal({
    address: params.wallet,
    functionCall: {
      abi: spec.abi,
      method: "getTransactions",
      params: {},
    },
  });
  return Array.isArray(result.output?.transactions)
    ? (result.output.transactions as T[])
    : [];
}

export async function getMultisigPendingTransactionsViaToncenter(
  spec: MultisigContractSpec,
  client: ToncenterClient,
  wallet: string,
  limit = 50,
): Promise<ToncenterMultisigPendingTransaction[]> {
  const { transactions = [] } = await client.transactionsByAccount(wallet, limit);
  const submissions = new Map<string, ToncenterMultisigPendingTransaction>();
  const completed = new Set<string>();

  for (const transaction of transactions) {
    const output = decodeMultisigOutput(spec, transaction, "submitTransaction");
    const transactionId = tokenString(output?.transId);
    if (output && transactionId) {
      submissions.set(transactionId, { transactionId, transaction, output });
      if (hasInternalTransfer(transaction)) completed.add(transactionId);
    }

    const confirmation = decodeMultisigInput(spec, transaction, "confirmTransaction");
    const confirmedTransactionId = tokenString(confirmation?.transactionId);
    if (confirmedTransactionId && hasInternalTransfer(transaction)) {
      completed.add(confirmedTransactionId);
    }
  }

  return [...submissions.values()].filter(({ transactionId }) => !completed.has(transactionId));
}

export function multisigConfirmationOutcome(
  transaction: ToncenterTransaction,
): MultisigConfirmation {
  return hasInternalTransfer(transaction) ? "executed" : "confirmed";
}

/**
 * Reads the destination, hash, signed expiration, and method input from an
 * external BOC without a network request. ABI decoding validates the expected
 * method body, but does not verify the destination account's contract code.
 */
export function parseMultisigExternalBoc(
  spec: MultisigContractSpec,
  boc: string,
  method: MultisigCall["method"],
): ParsedMultisigExternalBoc {
  const message = nekoton.parseMessageBase64Extended(boc);
  if (message.msgType !== "ExtIn" || !message.dst || !message.body) {
    throw new Error(
      `--boc must be a signed external ${spec.name} message with a destination and body`,
    );
  }

  let input: Record<string, unknown>;
  try {
    const decoded = nekoton.decodeInput(message.body, spec.abi, method, false);
    if (!decoded) throw new Error("not decoded");
    input = decoded.input as Record<string, unknown>;
  } catch {
    throw new Error(`--boc is not a ${spec.name} ${method} external message`);
  }

  return {
    wallet: message.dst,
    messageHash: message.hash,
    expireAt: readMultisigExternalMessageExpireAt(spec, message.body),
    input,
  };
}

export async function waitForToncenterMultisigSubmission(
  spec: MultisigContractSpec,
  client: ToncenterClient,
  wallet: string,
  messageHash: string,
  expireAt: number,
  method: MultisigCall["method"],
): Promise<ToncenterMultisigSubmission> {
  const submission = await waitForToncenterExternalBocSubmission(client, {
    wallet,
    messageHash,
    expireAt,
  });
  return {
    transaction: submission.transaction,
    output: submission.transaction
      ? decodeMultisigOutput(spec, submission.transaction, method)
      : undefined,
  };
}

function readMultisigExternalMessageExpireAt(
  spec: MultisigContractSpec,
  body: string,
): number {
  try {
    return readAbiV2SignedExternalMessageExpireAt(body);
  } catch {
    throw new Error(`--boc has an unsupported ${spec.name} signed external-message body`);
  }
}

function decodeMultisigOutput(
  spec: MultisigContractSpec,
  transaction: ToncenterTransaction,
  method: MultisigCall["method"],
): Record<string, unknown> | undefined {
  for (const message of getOutMessages(transaction)) {
    const body = getMessageBody(message);
    if (!body) continue;
    const decoded = nekoton.decodeOutput(body, spec.abi, method);
    if (decoded) return decoded.output as Record<string, unknown>;
  }

  return undefined;
}

function decodeMultisigInput(
  spec: MultisigContractSpec,
  transaction: ToncenterTransaction,
  method: "confirmTransaction",
): Record<string, unknown> | undefined {
  const body = getMessageBody(getInMessage(transaction));
  if (!body) return undefined;

  try {
    return nekoton.decodeInput(body, spec.abi, method, false)?.input as
      | Record<string, unknown>
      | undefined;
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

async function assertMultisigCustodian(
  spec: MultisigContractSpec,
  provider: Awaited<ReturnType<typeof createStandaloneProvider>>,
  wallet: string,
  publicKey: string,
) {
  const result = await provider.rawApi.runLocal({
    address: wallet,
    functionCall: {
      abi: spec.abi,
      method: "getCustodians",
      params: {},
    },
  });
  const custodians = Array.isArray(result.output?.custodians)
    ? (result.output.custodians as Array<{ pubkey: string }>)
    : [];
  const isCustodian = custodians.some(
    custodian => BigInt(custodian.pubkey).toString(16).padStart(64, "0") === publicKey,
  );

  if (!isCustodian) {
    throw new Error(`public key ${publicKey} is not a custodian of ${wallet}`);
  }
}
