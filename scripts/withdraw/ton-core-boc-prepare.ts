import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseTonCoreWalletV5WithdrawArgs } from "../../src/withdraw/parse-offline";
import { buildTonCoreWalletV5Boc } from "../../src/withdraw/ton-core-wallet-v5-offline";

runMain(async () => {
  const message = buildTonCoreWalletV5Boc(parseTonCoreWalletV5WithdrawArgs(new Args()));
  printJson({
    transport: "offline BOC preparation",
    builder: "@ton/core wallet v5 r1",
    status: "prepared_offline",
    message,
  });
});
