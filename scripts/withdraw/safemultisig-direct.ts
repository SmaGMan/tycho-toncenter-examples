import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendSafeMultisigWalletDirect } from "../../src/withdraw/safemultisig-standalone";
import { parseSafeMultisigStandaloneDirectArgs } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const params = parseSafeMultisigStandaloneDirectArgs(new Args());
  const result = await sendSafeMultisigWalletDirect(params);
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
