import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { getMsig2PendingTransactions } from "../../src/withdraw/msig2-standalone";
import { parseMsig2PendingDirectArgs } from "../../src/withdraw/parse";

runMain(async () => {
  const params = parseMsig2PendingDirectArgs(new Args());
  const transactions = await getMsig2PendingTransactions(params);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: params.wallet,
    transactions,
  });
});
