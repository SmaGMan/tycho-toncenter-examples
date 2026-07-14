import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendMsig2WalletDirect } from "../../src/withdraw/msig2-standalone";
import { parseMsig2StandaloneDirectArgs } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const params = parseMsig2StandaloneDirectArgs(new Args());
  const result = await sendMsig2WalletDirect(params);
  const observation = submissionObservation(result.transaction);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: params.wallet,
    action: "submitTransaction",
    status: "accepted_by_jrpc",
    observation,
    result,
    transaction: result.transaction,
    transactionId: observation === "included" ? result.output?.transId : undefined,
  });
});
