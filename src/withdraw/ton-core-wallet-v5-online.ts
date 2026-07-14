import { Address, Cell, loadMessage } from "@ton/core";
import { keyPairFromSecretKey } from "@ton/crypto";

import { ToncenterClient, readSeqnoFromRunGetMethod } from "../toncenter/client";
import type { ToncenterTransaction } from "../toncenter/types";
import {
  computeTonCoreWalletV5Address,
  type TonCoreWalletV5WithdrawParams,
} from "./ton-core-wallet-v5-offline";
import { waitForToncenterExternalMessageSubmission } from "./toncenter-external-boc";

const AUTH_SIGNED_EXTERNAL = 0x7369676e;
const SEQNO_ZERO_OBSERVATION_MS = 60_000;

export type ParsedTonCoreWalletV5ExternalBoc = {
  wallet: string;
  messageHash: string;
  validUntil: number;
  seqno: number;
};

export type TonCoreWalletV5Submission = {
  transaction?: ToncenterTransaction;
};

export async function resolveTonCoreWalletV5Seqno(
  client: ToncenterClient,
  params: TonCoreWalletV5WithdrawParams,
): Promise<number> {
  if (params.seqno != null) return params.seqno;
  if (params.includeStateInit) return 0;

  const wallet = resolveTonCoreWalletV5Wallet(params);
  return readTonCoreWalletV5Seqno(client, wallet);
}

export async function readTonCoreWalletV5Seqno(client: ToncenterClient, wallet: string): Promise<number> {
  const result = await client.runGetMethod(wallet, "seqno");
  return readSeqnoFromRunGetMethod(result);
}

/**
 * Reads only the external-message envelope and Wallet V5 signed header. This
 * lets the online sender correlate the BOC with Toncenter history without a
 * wallet address or key on the online machine.
 */
export function parseTonCoreWalletV5ExternalBoc(boc: string): ParsedTonCoreWalletV5ExternalBoc {
  let root: Cell;
  let message: ReturnType<typeof loadMessage>;
  try {
    root = Cell.fromBase64(boc);
    message = loadMessage(root.beginParse());
  } catch {
    throw new Error("--boc must be a Wallet V5 signed external message");
  }

  if (message.info.type !== "external-in") {
    throw new Error("--boc must be a Wallet V5 signed external message");
  }

  const body = message.body.beginParse();
  if (body.remainingBits < 128 || body.loadUint(32) !== AUTH_SIGNED_EXTERNAL) {
    throw new Error("--boc is not a Wallet V5 signed external message");
  }

  // Wallet V5 stores an XOR-obfuscated wallet id before valid_until and seqno.
  body.skip(32);
  const validUntil = body.loadUint(32);
  const seqno = body.loadUint(32);

  return {
    wallet: message.info.dest.toRawString(),
    messageHash: root.hash().toString("hex"),
    validUntil,
    seqno,
  };
}

/**
 * Looks for the exact external-message hash in the destination wallet's
 * history. Wallet V5 uses 0xffffffff for the initial seqno, so that case gets
 * a bounded observation window instead of waiting until 2106.
 */
export async function waitForTonCoreWalletV5Submission(
  client: ToncenterClient,
  message: ParsedTonCoreWalletV5ExternalBoc,
): Promise<TonCoreWalletV5Submission> {
  const deadline = message.seqno === 0 && message.validUntil === 0xffff_ffff
    ? Date.now() + SEQNO_ZERO_OBSERVATION_MS
    : Math.max(Date.now() + 5_000, message.validUntil * 1_000 + 5_000);
  return waitForToncenterExternalMessageSubmission(client, message, deadline);
}

function resolveTonCoreWalletV5Wallet(params: TonCoreWalletV5WithdrawParams): string {
  const publicKey = keyPairFromSecretKey(params.secretKey).publicKey;
  const computedWallet = computeTonCoreWalletV5Address({
    publicKey,
    workchain: params.workchain,
    networkGlobalId: params.networkGlobalId,
    subwalletNumber: params.subwalletNumber,
  });
  const wallet = params.wallet ? Address.parse(params.wallet).toRawString() : computedWallet;

  if (wallet !== computedWallet) {
    throw new Error(
      `wallet address does not match secret key/workchain/wallet id: expected ${computedWallet}`,
    );
  }

  return wallet;
}
