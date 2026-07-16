import type { ToncenterClient } from "../toncenter/client";
import {
  buildSafeMultisigConfirmBoc,
  buildSafeMultisigWalletBoc,
  type SafeMultisigConfirmParams,
  type SafeMultisigWalletWithdrawParams,
} from "./safemultisig-standalone-offline";
import {
  parseSafeMultisigExternalBoc,
  waitForToncenterSafeMultisigSubmission,
} from "./safemultisig-standalone-online";

export * from "./safemultisig-standalone-offline";
export * from "./safemultisig-standalone-online";

/** One-step compatibility flow: build, broadcast, and observe a submit BOC. */
export async function sendSafeMultisigWalletBocViaToncenter(
  client: ToncenterClient,
  params: SafeMultisigWalletWithdrawParams,
) {
  const message = buildSafeMultisigWalletBoc(params);
  const externalMessage = parseSafeMultisigExternalBoc(message.boc, "submitTransaction");
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForToncenterSafeMultisigSubmission(
    client,
    externalMessage.wallet,
    externalMessage.messageHash,
    externalMessage.expireAt,
    "submitTransaction",
  );
  return { message, externalMessage, result, ...submission };
}

/** One-step compatibility flow: build, broadcast, and observe a confirm BOC. */
export async function sendSafeMultisigConfirmBocViaToncenter(
  client: ToncenterClient,
  params: SafeMultisigConfirmParams,
) {
  const message = buildSafeMultisigConfirmBoc(params);
  const externalMessage = parseSafeMultisigExternalBoc(message.boc, "confirmTransaction");
  const result = await client.sendBocReturnHash(message.boc);
  const submission = await waitForToncenterSafeMultisigSubmission(
    client,
    externalMessage.wallet,
    externalMessage.messageHash,
    externalMessage.expireAt,
    "confirmTransaction",
  );
  return { message, externalMessage, result, ...submission };
}
