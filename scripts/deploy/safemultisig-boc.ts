import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseSafeMultisigDeploymentArgs } from "../../src/deploy/parse";
import { formatToncenterSafeMultisigDeployment } from "../../src/deploy/safemultisig-output";
import { buildSafeMultisigDeployment } from "../../src/deploy/safemultisig-offline";
import { sendSafeMultisigDeploymentBoc } from "../../src/deploy/safemultisig-online";
import { parseToncenterClient } from "../../src/withdraw/parse-online";

runMain(async () => {
  const args = new Args();
  const deployment = buildSafeMultisigDeployment(parseSafeMultisigDeploymentArgs(args));
  const sent = await sendSafeMultisigDeploymentBoc(parseToncenterClient(args), deployment.message.boc);
  printJson(formatToncenterSafeMultisigDeployment(sent, deployment.message));
});
