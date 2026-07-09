import { Args } from "../../src/cli/args";
import { tychoRpcEndpoint } from "../../src/cli/env";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { readStandaloneSignatureIdInfo } from "../../src/config/signature-id-standalone";

runMain(async () => {
  const args = new Args();
  const rpc = tychoRpcEndpoint(args.get("rpc"));
  const info = await readStandaloneSignatureIdInfo(rpc);

  printJson({
    source: "everscale-standalone-client",
    rpc,
    ...info,
  });
});
