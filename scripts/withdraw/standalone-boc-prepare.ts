import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { buildEverWalletBoc } from "../../src/withdraw/everwallet-standalone-offline";
import { parseEverWalletWithdrawArgs } from "../../src/withdraw/parse-offline";

runMain(async () => {
  const message = buildEverWalletBoc(parseEverWalletWithdrawArgs(new Args()));
  printJson({
    transport: "offline BOC preparation",
    status: "prepared_offline",
    message,
  });
});
