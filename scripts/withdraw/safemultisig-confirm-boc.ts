import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  safeMultisigConfirmationOutcome,
  sendSafeMultisigConfirmBocViaToncenter,
} from "../../src/withdraw/safemultisig-standalone";
import { parseSafeMultisigConfirmArgs, parseToncenterClient } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseSafeMultisigConfirmArgs(args);
  const result = await sendSafeMultisigConfirmBocViaToncenter(client, params);
  const observation = submissionObservation(result.transaction);
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: result.externalMessage.wallet,
    action: "confirmTransaction",
    transactionId: params.transactionId,
    message: result.message,
    messageHash: result.externalMessage.messageHash,
    expireAt: result.externalMessage.expireAt,
    expiresAt: result.externalMessage.expireAt,
    status: "accepted_by_toncenter",
    observation,
    result: result.result,
    confirmation: observation === "included" && result.transaction
      ? safeMultisigConfirmationOutcome(result.transaction)
      : undefined,
    transaction: result.transaction,
  });
});
