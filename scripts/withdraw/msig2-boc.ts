import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendMsig2WalletBocViaToncenter } from "../../src/withdraw/msig2-standalone";
import { parseMsig2WalletWithdrawArgs, parseToncenterClient } from "../../src/withdraw/parse";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseMsig2WalletWithdrawArgs(args);
  const result = await sendMsig2WalletBocViaToncenter(client, params);
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: "msig2",
    message: result.message,
    result: result.result,
    transaction: result.transaction,
    transactionId: result.output?.transId,
  });
});
