import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { buildMsig2WalletBoc } from "../../src/withdraw/msig2-standalone-offline";
import { parseMsig2WalletWithdrawArgs } from "../../src/withdraw/parse-offline";

runMain(async () => {
  const params = parseMsig2WalletWithdrawArgs(new Args());
  const message = buildMsig2WalletBoc(params);
  printJson({
    transport: "offline BOC preparation",
    wallet: params.wallet,
    action: "submitTransaction",
    message,
  });
});
