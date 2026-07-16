import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  parseSafeMultisigExternalBoc,
  safeMultisigConfirmationOutcome,
  waitForToncenterSafeMultisigSubmission,
} from "../../src/withdraw/safemultisig-standalone-online";
import { parseBocSendArgs, parseToncenterClient } from "../../src/withdraw/parse-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const { boc } = parseBocSendArgs(args);
  const message = parseSafeMultisigExternalBoc(boc, "confirmTransaction");
  const client = parseToncenterClient(args);
  const result = await client.sendBocReturnHash(boc);
  const submission = await waitForToncenterSafeMultisigSubmission(
    client,
    message.wallet,
    message.messageHash,
    message.expireAt,
    "confirmTransaction",
  );
  const observation = submissionObservation(submission.transaction);

  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: message.wallet,
    action: "confirmTransaction",
    transactionId: message.input.transactionId,
    messageHash: message.messageHash,
    expireAt: message.expireAt,
    expiresAt: message.expireAt,
    status: "accepted_by_toncenter",
    observation,
    result,
    confirmation: observation === "included" && submission.transaction
      ? safeMultisigConfirmationOutcome(submission.transaction)
      : undefined,
    transaction: submission.transaction,
  });
});
