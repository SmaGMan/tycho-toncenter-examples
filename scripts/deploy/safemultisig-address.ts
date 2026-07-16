import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseSafeMultisigAddressArgs } from "../../src/deploy/parse";
import {
  deriveSafeMultisigAddress,
  SAFEMULTISIG_ARTIFACT,
} from "../../src/deploy/safemultisig-offline";

runMain(async () => {
  const address = deriveSafeMultisigAddress(parseSafeMultisigAddressArgs(new Args()));
  printJson({
    transport: "offline address derivation",
    action: "derive SafeMultisig address",
    status: "derived_offline",
    ...address,
    artifact: SAFEMULTISIG_ARTIFACT,
  });
});
