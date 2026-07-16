import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { buildSafeMultisigWalletBoc } from "../../src/withdraw/safemultisig-standalone-offline";
import { parseSafeMultisigWalletWithdrawArgs } from "../../src/withdraw/parse-offline";

runMain(async () => {
  const params = parseSafeMultisigWalletWithdrawArgs(new Args());
  const message = buildSafeMultisigWalletBoc(params);
  printJson({
    transport: "offline BOC preparation",
    wallet: params.wallet,
    action: "submitTransaction",
    status: "prepared_offline",
    message,
  });
});
