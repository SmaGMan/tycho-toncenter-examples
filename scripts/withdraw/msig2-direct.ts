import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendMsig2WalletDirect } from "../../src/withdraw/msig2-standalone";
import { parseMsig2StandaloneDirectArgs } from "../../src/withdraw/parse";

runMain(async () => {
  const params = parseMsig2StandaloneDirectArgs(new Args());
  const result = await sendMsig2WalletDirect(params);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: "msig2",
    action: "submitTransaction",
    transaction: result.transaction,
    transactionId: result.output?.transId,
  });
});
