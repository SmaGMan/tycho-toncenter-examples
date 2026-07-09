import { Args } from "../../src/cli/args";
import { tychoRpcEndpoint } from "../../src/cli/env";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { fetchBlockchainConfig, readSignatureIdInfo } from "../../src/config/signature-id";

runMain(async () => {
  const args = new Args();
  const configBoc = args.get("config-boc");
  const config = configBoc
    ? {
      globalId: args.int("global-id") ?? fail("--global-id is required with --config-boc"),
      config: configBoc,
    }
    : await fetchBlockchainConfig(tychoRpcEndpoint(args.get("rpc")));

  printJson({
    source: configBoc ? "config-boc" : "getBlockchainConfig",
    ...readSignatureIdInfo(config),
  });
});

function fail(message: string): never {
  throw new Error(message);
}
