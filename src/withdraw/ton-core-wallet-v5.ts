import type { ToncenterClient } from "../toncenter/client";
import {
  buildTonCoreWalletV5Boc as buildTonCoreWalletV5BocOffline,
  type TonCoreWalletV5WithdrawParams,
} from "./ton-core-wallet-v5-offline";
import {
  parseTonCoreWalletV5ExternalBoc,
  resolveTonCoreWalletV5Seqno,
  waitForTonCoreWalletV5Submission,
} from "./ton-core-wallet-v5-online";

export { computeTonCoreWalletV5Address } from "./ton-core-wallet-v5-offline";
export type {
  BuiltTonCoreWalletV5Boc,
  TonCoreWalletV5AddressParams,
  TonCoreWalletV5WithdrawParams,
} from "./ton-core-wallet-v5-offline";
export {
  parseTonCoreWalletV5ExternalBoc,
  readTonCoreWalletV5Seqno,
  resolveTonCoreWalletV5Seqno,
  waitForTonCoreWalletV5Submission,
} from "./ton-core-wallet-v5-online";
export type {
  ParsedTonCoreWalletV5ExternalBoc,
  TonCoreWalletV5Submission,
} from "./ton-core-wallet-v5-online";

/**
 * Compatibility builder for callers that want Toncenter to resolve seqno when
 * it was not supplied. New offline preparation callers use the offline module.
 */
export async function buildTonCoreWalletV5Boc(
  client: ToncenterClient,
  params: TonCoreWalletV5WithdrawParams,
) {
  const seqno = await resolveTonCoreWalletV5Seqno(client, params);
  return buildTonCoreWalletV5BocOffline({ ...params, seqno });
}

/** Compatibility helper for the existing one-step build-and-broadcast flow. */
export async function sendTonCoreWalletV5BocViaToncenter(
  client: ToncenterClient,
  params: TonCoreWalletV5WithdrawParams,
) {
  const message = await buildTonCoreWalletV5Boc(client, params);
  const externalMessage = parseTonCoreWalletV5ExternalBoc(message.boc);
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForTonCoreWalletV5Submission(client, externalMessage);
  return { message, externalMessage, result, transaction: submission.transaction };
}
