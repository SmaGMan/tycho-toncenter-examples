import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseSafeMultisigDeploymentArgs } from "../../src/deploy/parse";
import {
  buildSafeMultisigDeployment,
  SAFEMULTISIG_ARTIFACT,
} from "../../src/deploy/safemultisig-offline";

runMain(async () => {
  const deployment = buildSafeMultisigDeployment(parseSafeMultisigDeploymentArgs(new Args()));
  printJson({
    transport: "offline BOC preparation",
    action: "constructor",
    status: "prepared_offline",
    ...deployment,
    artifact: SAFEMULTISIG_ARTIFACT,
  });
});
