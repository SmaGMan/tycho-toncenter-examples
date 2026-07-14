import { Cell } from "@ton/core";

import { ToncenterClient } from "../toncenter/client";
import { getInMessage } from "../toncenter/normalize";
import type { ToncenterTransaction } from "../toncenter/types";

export type ToncenterExternalMessage = {
  wallet: string;
  messageHash: string;
};

export type ToncenterExternalBoc = ToncenterExternalMessage & {
  expireAt: number;
};

export type ToncenterExternalMessageSubmission = {
  transaction?: ToncenterTransaction;
};

/**
 * Reads ABI v2's signed external-message expiration. ABI and method validation
 * remains the responsibility of the caller's contract-specific decoder.
 */
export function readAbiV2SignedExternalMessageExpireAt(body: string): number {
  try {
    const slice = Cell.fromBase64(body).beginParse();
    if (slice.remainingBits < 898) throw new Error("message body is too short");

    // signature, two-bit field, pubkey, time, expire, function id
    slice.skip(512 + 2 + 256 + 64);
    return slice.loadUint(32);
  } catch {
    throw new Error("unsupported ABI v2 signed external-message body");
  }
}

/** Looks up the exact external message in the destination wallet's history. */
export async function waitForToncenterExternalBocSubmission(
  client: ToncenterClient,
  message: ToncenterExternalBoc,
): Promise<ToncenterExternalMessageSubmission> {
  const deadline = Math.max(Date.now() + 5_000, message.expireAt * 1_000 + 5_000);
  return waitForToncenterExternalMessageSubmission(client, message, deadline);
}

/** Looks up the exact external message until the caller-provided deadline. */
export async function waitForToncenterExternalMessageSubmission(
  client: ToncenterClient,
  message: ToncenterExternalMessage,
  deadline: number,
): Promise<ToncenterExternalMessageSubmission> {
  const toncenterHash = Buffer.from(message.messageHash, "hex").toString("base64");

  while (Date.now() < deadline) {
    const { transactions = [] } = await client.transactionsByAccount(message.wallet);
    const transaction = transactions.find(item => getInMessage(item)?.hash === toncenterHash);
    if (transaction) return { transaction };
    await delay(1_000);
  }

  return {};
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
