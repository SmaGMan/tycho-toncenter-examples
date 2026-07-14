import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { buildMsig2ConfirmBoc } from "../../src/withdraw/msig2-standalone-offline";
import { parseMsig2ConfirmArgs } from "../../src/withdraw/parse-offline";

runMain(async () => {
  const params = parseMsig2ConfirmArgs(new Args());
  const message = buildMsig2ConfirmBoc(params);
  printJson({
    transport: "offline BOC preparation",
    wallet: params.wallet,
    action: "confirmTransaction",
    transactionId: params.transactionId,
    message,
  });
});
