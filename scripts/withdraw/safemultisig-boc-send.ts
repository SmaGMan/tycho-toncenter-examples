import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  parseSafeMultisigExternalBoc,
  waitForToncenterSafeMultisigSubmission,
} from "../../src/withdraw/safemultisig-standalone-online";
import { parseBocSendArgs, parseToncenterClient } from "../../src/withdraw/parse-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const { boc } = parseBocSendArgs(args);
  const message = parseSafeMultisigExternalBoc(boc, "submitTransaction");
  const client = parseToncenterClient(args);
  const result = await client.sendBocReturnHash(boc);
  const submission = await waitForToncenterSafeMultisigSubmission(
    client,
    message.wallet,
    message.messageHash,
    message.expireAt,
    "submitTransaction",
  );
  const observation = submissionObservation(submission.transaction);

  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: message.wallet,
    action: "submitTransaction",
    status: "accepted_by_toncenter",
    observation,
    messageHash: message.messageHash,
    expireAt: message.expireAt,
    expiresAt: message.expireAt,
    input: message.input,
    result,
    transaction: submission.transaction,
    transactionId: observation === "included" ? submission.output?.transId : undefined,
  });
});
