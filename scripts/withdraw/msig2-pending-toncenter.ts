import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { getMsig2PendingTransactionsViaToncenter } from "../../src/withdraw/msig2-standalone";
import { parseMsig2PendingToncenterArgs, parseToncenterClient } from "../../src/withdraw/parse";

runMain(async () => {
  const args = new Args();
  const { wallet, limit } = parseMsig2PendingToncenterArgs(args);
  const transactions = await getMsig2PendingTransactionsViaToncenter(parseToncenterClient(args), wallet, limit);
  printJson({
    transport: "toncenter v3 transactions",
    wallet: "msig2",
    transactions: transactions.map(({ transactionId, transaction }) => ({
      transactionId,
      transactionHash: transaction.hash,
      createdAt: transaction.now,
    })),
  });
});
