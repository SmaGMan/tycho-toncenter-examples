import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { parseTonCoreWalletV5WithdrawArgs, parseToncenterClient } from "../../src/withdraw/parse";
import { sendTonCoreWalletV5BocViaToncenter } from "../../src/withdraw/ton-core-wallet-v5";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseTonCoreWalletV5WithdrawArgs(args);
  const result = await sendTonCoreWalletV5BocViaToncenter(client, params);
  printJson({
    transport: "toncenter sendBocReturnHash",
    builder: "@ton/core wallet v5 r1",
    message: result.message,
    result: result.result,
  });
});
