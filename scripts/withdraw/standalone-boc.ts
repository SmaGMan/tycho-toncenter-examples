import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { sendEverWalletBocViaToncenter } from "../../src/withdraw/everwallet-standalone";
import { parseEverWalletWithdrawArgs, parseToncenterClient } from "../../src/withdraw/parse";

runMain(async () => {
  const args = new Args();
  const client = parseToncenterClient(args);
  const params = parseEverWalletWithdrawArgs(args);
  const result = await sendEverWalletBocViaToncenter(client, params);
  printJson({
    transport: "toncenter sendBocReturnHash",
    message: result.message,
    result: result.result,
  });
});
