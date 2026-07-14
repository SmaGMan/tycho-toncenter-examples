import type { ToncenterClient } from "../toncenter/client";
import { buildEverWalletBoc } from "./everwallet-standalone-offline";
import type { EverWalletWithdrawParams } from "./everwallet-standalone-offline";
import {
  parseEverWalletExternalBoc,
  waitForToncenterEverWalletSubmission,
} from "./everwallet-standalone-online";

export {
  assertEverWalletAddressMatchesStateInit,
  buildEverWalletBoc,
} from "./everwallet-standalone-offline";
export type {
  BuiltEverWalletBoc,
  EverWalletWithdrawParams,
} from "./everwallet-standalone-offline";
export {
  parseEverWalletExternalBoc,
  sendEverWalletDirect,
  waitForToncenterEverWalletSubmission,
} from "./everwallet-standalone-online";
export type { ParsedEverWalletExternalBoc } from "./everwallet-standalone-online";

/**
 * Compatibility helper for callers that still want build-and-broadcast in one
 * step. New prepare/send entrypoints use the individual offline/online flows.
 */
export async function sendEverWalletBocViaToncenter(
  client: ToncenterClient,
  params: EverWalletWithdrawParams,
) {
  const message = buildEverWalletBoc(params);
  const externalMessage = parseEverWalletExternalBoc(message.boc);
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForToncenterEverWalletSubmission(client, externalMessage);
  return { message, externalMessage, result, transaction: submission.transaction };
}
