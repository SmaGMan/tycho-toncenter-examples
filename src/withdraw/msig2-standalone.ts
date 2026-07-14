import type { ToncenterClient } from "../toncenter/client";
import {
  buildMsig2ConfirmBoc,
  buildMsig2WalletBoc,
  type Msig2ConfirmParams,
  type Msig2WalletWithdrawParams,
} from "./msig2-standalone-offline";
import {
  parseMsig2ExternalBoc,
  waitForToncenterMsig2Submission,
} from "./msig2-standalone-online";

export * from "./msig2-standalone-offline";
export * from "./msig2-standalone-online";

/**
 * Compatibility helper for callers that still want the previous one-step
 * submit flow: build locally, broadcast through toncenter, then observe the
 * wallet history until expiration.
 */
export async function sendMsig2WalletBocViaToncenter(
  client: ToncenterClient,
  params: Msig2WalletWithdrawParams,
) {
  const message = buildMsig2WalletBoc(params);
  const externalMessage = parseMsig2ExternalBoc(message.boc, "submitTransaction");
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForToncenterMsig2Submission(
    client,
    externalMessage.wallet,
    externalMessage.messageHash,
    externalMessage.expireAt,
    "submitTransaction",
  );
  return { message, externalMessage, result, ...submission };
}

/**
 * Compatibility helper for callers that still want the previous one-step
 * confirmation flow: build locally, broadcast through toncenter, then observe
 * the wallet history until expiration.
 */
export async function sendMsig2ConfirmBocViaToncenter(
  client: ToncenterClient,
  params: Msig2ConfirmParams,
) {
  const message = buildMsig2ConfirmBoc(params);
  const externalMessage = parseMsig2ExternalBoc(message.boc, "confirmTransaction");
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForToncenterMsig2Submission(
    client,
    externalMessage.wallet,
    externalMessage.messageHash,
    externalMessage.expireAt,
    "confirmTransaction",
  );
  return { message, externalMessage, result, ...submission };
}
