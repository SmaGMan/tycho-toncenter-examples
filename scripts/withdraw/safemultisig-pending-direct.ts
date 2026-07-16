import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { getSafeMultisigPendingTransactions } from "../../src/withdraw/safemultisig-standalone";
import { parseSafeMultisigPendingDirectArgs } from "../../src/withdraw/parse";

runMain(async () => {
  const params = parseSafeMultisigPendingDirectArgs(new Args());
  const transactions = await getSafeMultisigPendingTransactions(params);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: params.wallet,
    transactions,
  });
});
