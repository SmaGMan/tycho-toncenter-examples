import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendEverWalletDirect } from "../../src/withdraw/everwallet-standalone-online";
import { parseStandaloneDirectArgs } from "../../src/withdraw/parse-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const params = parseStandaloneDirectArgs(new Args());
  const result = await sendEverWalletDirect(params);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: params.wallet,
    action: "sendTransaction",
    status: "accepted_by_jrpc",
    observation: submissionObservation(result.transaction),
    result,
    transaction: result.transaction,
  });
});
