import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseStandaloneDirectArgs } from "../../src/withdraw/parse";
import { sendEverWalletDirect } from "../../src/withdraw/everwallet-standalone";

runMain(async () => {
  const params = parseStandaloneDirectArgs(new Args());
  const result = await sendEverWalletDirect(params);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    transaction: result.transaction,
  });
});
