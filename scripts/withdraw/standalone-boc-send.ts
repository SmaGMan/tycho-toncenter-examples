import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  parseEverWalletExternalBoc,
  waitForToncenterEverWalletSubmission,
} from "../../src/withdraw/everwallet-standalone-online";
import { parseBocSendArgs, parseToncenterClient } from "../../src/withdraw/parse-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const { boc } = parseBocSendArgs(args);
  const message = parseEverWalletExternalBoc(boc);
  const client = parseToncenterClient(args);
  const result = await client.sendBocReturnHash(boc);
  const submission = await waitForToncenterEverWalletSubmission(client, message);
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: message.wallet,
    action: "sendTransaction",
    input: message.input,
    messageHash: message.messageHash,
    expireAt: message.expireAt,
    expiresAt: message.expireAt,
    status: "accepted_by_toncenter",
    observation: submissionObservation(submission.transaction),
    result,
    transaction: submission.transaction,
  });
});
