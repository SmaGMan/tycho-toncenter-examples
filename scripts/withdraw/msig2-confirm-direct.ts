import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { confirmMsig2TransactionDirect, msig2ConfirmationStatus } from "../../src/withdraw/msig2-standalone";
import { parseMsig2ConfirmDirectArgs } from "../../src/withdraw/parse";

runMain(async () => {
  const params = parseMsig2ConfirmDirectArgs(new Args());
  const result = await confirmMsig2TransactionDirect(params);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: "msig2",
    action: "confirmTransaction",
    transactionId: params.transactionId,
    status: msig2ConfirmationStatus(result.transaction),
    transaction: result.transaction,
  });
});
