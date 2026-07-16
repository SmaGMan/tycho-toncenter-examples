import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { formatToncenterSafeMultisigDeployment } from "../../src/deploy/safemultisig-output";
import { sendSafeMultisigDeploymentBoc } from "../../src/deploy/safemultisig-online";
import { parseBocSendArgs, parseToncenterClient } from "../../src/withdraw/parse-online";

runMain(async () => {
  const args = new Args();
  const { boc } = parseBocSendArgs(args);
  const sent = await sendSafeMultisigDeploymentBoc(parseToncenterClient(args), boc);
  printJson(formatToncenterSafeMultisigDeployment(sent));
});
