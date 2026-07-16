import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseSafeMultisigDirectDeploymentArgs } from "../../src/deploy/parse";
import { SAFEMULTISIG_ARTIFACT } from "../../src/deploy/safemultisig-offline";
import { deploySafeMultisigDirect } from "../../src/deploy/safemultisig-online";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const result = await deploySafeMultisigDirect(parseSafeMultisigDirectDeploymentArgs(new Args()));
  printJson({
    transport: "standalone-client JRPC",
    wallet: result.deployment.wallet,
    action: "constructor",
    status: "accepted_by_jrpc",
    observation: submissionObservation(result.transaction),
    deployment: result.deployment,
    balanceBefore: result.balanceBefore,
    artifact: SAFEMULTISIG_ARTIFACT,
    transaction: result.transaction,
    output: result.output,
  });
});
