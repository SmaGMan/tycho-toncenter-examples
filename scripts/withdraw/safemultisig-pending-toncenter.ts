import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { getSafeMultisigPendingTransactionsViaToncenter } from "../../src/withdraw/safemultisig-standalone";
import {
  parseSafeMultisigPendingToncenterArgs,
  parseToncenterClient,
} from "../../src/withdraw/parse";

runMain(async () => {
  const args = new Args();
  const { wallet, limit } = parseSafeMultisigPendingToncenterArgs(args);
  const transactions = await getSafeMultisigPendingTransactionsViaToncenter(
    parseToncenterClient(args),
    wallet,
    limit,
  );
  printJson({
    transport: "toncenter v3 transactions",
    wallet,
    transactions: transactions.map(({ transactionId, transaction }) => ({
      transactionId,
      transactionHash: transaction.hash,
      createdAt: transaction.now,
    })),
  });
});
