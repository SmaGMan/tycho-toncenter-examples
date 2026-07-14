import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  msig2ConfirmationOutcome,
  parseMsig2ExternalBoc,
  waitForToncenterMsig2Submission,
} from "../../src/withdraw/msig2-standalone-online";
import { parseBocSendArgs, parseToncenterClient } from "../../src/withdraw/parse-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const { boc } = parseBocSendArgs(args);
  const message = parseMsig2ExternalBoc(boc, "confirmTransaction");
  const client = parseToncenterClient(args);
  const result = await client.sendBocReturnHash(boc);
  const submission = await waitForToncenterMsig2Submission(
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
      ? msig2ConfirmationOutcome(submission.transaction)
      : undefined,
    transaction: submission.transaction,
  });
});
