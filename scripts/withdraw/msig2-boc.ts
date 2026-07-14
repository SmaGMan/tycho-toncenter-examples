import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendMsig2WalletBocViaToncenter } from "../../src/withdraw/msig2-standalone";
import { parseMsig2WalletWithdrawArgs, parseToncenterClient } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseMsig2WalletWithdrawArgs(args);
  const result = await sendMsig2WalletBocViaToncenter(client, params);
  const observation = submissionObservation(result.transaction);
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: result.externalMessage.wallet,
    message: result.message,
    action: "submitTransaction",
    messageHash: result.externalMessage.messageHash,
    expireAt: result.externalMessage.expireAt,
    expiresAt: result.externalMessage.expireAt,
    status: "accepted_by_toncenter",
    observation,
    result: result.result,
    transaction: result.transaction,
    transactionId: observation === "included" ? result.output?.transId : undefined,
  });
});
