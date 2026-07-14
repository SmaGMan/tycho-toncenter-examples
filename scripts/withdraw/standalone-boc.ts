import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendEverWalletBocViaToncenter } from "../../src/withdraw/everwallet-standalone";
import { parseEverWalletWithdrawArgs } from "../../src/withdraw/parse-offline";
import { parseToncenterClient } from "../../src/withdraw/parse-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const args = new Args();
  const params = parseEverWalletWithdrawArgs(args);
  const result = await sendEverWalletBocViaToncenter(
    parseToncenterClient(args),
    params,
  );
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: result.externalMessage.wallet,
    action: "sendTransaction",
    input: result.externalMessage.input,
    messageHash: result.externalMessage.messageHash,
    expireAt: result.externalMessage.expireAt,
    expiresAt: result.externalMessage.expireAt,
    status: "accepted_by_toncenter",
    observation: submissionObservation(result.transaction),
    message: result.message,
    result: result.result,
    transaction: result.transaction,
  });
});
