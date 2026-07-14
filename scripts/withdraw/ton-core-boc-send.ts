import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseBocSendArgs, parseToncenterClient } from "../../src/withdraw/parse-online";
import {
  parseTonCoreWalletV5ExternalBoc,
  waitForTonCoreWalletV5Submission,
} from "../../src/withdraw/ton-core-wallet-v5-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const { boc } = parseBocSendArgs(args);
  const message = parseTonCoreWalletV5ExternalBoc(boc);
  const client = parseToncenterClient(args);
  const result = await client.sendBocReturnHash(boc);
  const submission = await waitForTonCoreWalletV5Submission(client, message);
  printJson({
    transport: "toncenter sendBocReturnHash",
    builder: "@ton/core wallet v5 r1",
    wallet: message.wallet,
    action: "transfer",
    messageHash: message.messageHash,
    seqno: message.seqno,
    validUntil: message.validUntil,
    expiresAt: message.validUntil,
    status: "accepted_by_toncenter",
    observation: submissionObservation(submission.transaction),
    result,
    transaction: submission.transaction,
  });
});
