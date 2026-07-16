import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendSafeMultisigWalletBocViaToncenter } from "../../src/withdraw/safemultisig-standalone";
import { parseSafeMultisigWalletWithdrawArgs, parseToncenterClient } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseSafeMultisigWalletWithdrawArgs(args);
  const result = await sendSafeMultisigWalletBocViaToncenter(client, params);
  const observation = submissionObservation(result.transaction);
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: result.externalMessage.wallet,
    message: result.message,
    action: "submitTransaction",
    messageHash: result.externalMessage.messageHash,
    expireAt: result.externalMessage.expireAt,
    expiresAt: result.externalMessage.expireAt,
    input: result.externalMessage.input,
    status: "accepted_by_toncenter",
    observation,
    result: result.result,
    transaction: result.transaction,
    transactionId: observation === "included" ? result.output?.transId : undefined,
  });
});
