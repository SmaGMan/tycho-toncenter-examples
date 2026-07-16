import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { buildSafeMultisigConfirmBoc } from "../../src/withdraw/safemultisig-standalone-offline";
import { parseSafeMultisigConfirmArgs } from "../../src/withdraw/parse-offline";

runMain(async () => {
  const params = parseSafeMultisigConfirmArgs(new Args());
  const message = buildSafeMultisigConfirmBoc(params);
  printJson({
    transport: "offline BOC preparation",
    wallet: params.wallet,
    action: "confirmTransaction",
    transactionId: params.transactionId,
    status: "prepared_offline",
    message,
  });
});
