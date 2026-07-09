import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { msig2ConfirmationStatus, sendMsig2ConfirmBocViaToncenter } from "../../src/withdraw/msig2-standalone";
import { parseMsig2ConfirmArgs, parseToncenterClient } from "../../src/withdraw/parse";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseMsig2ConfirmArgs(args);
  const result = await sendMsig2ConfirmBocViaToncenter(client, params);
  printJson({
    transport: "toncenter sendBocReturnHash",
    wallet: "msig2",
    action: "confirmTransaction",
    transactionId: params.transactionId,
    message: result.message,
    result: result.result,
    status: msig2ConfirmationStatus(result.transaction),
    transaction: result.transaction,
  });
});
