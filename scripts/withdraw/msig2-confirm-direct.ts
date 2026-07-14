import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  confirmMsig2TransactionDirect,
  msig2ConfirmationOutcome,
} from "../../src/withdraw/msig2-standalone";
import { parseMsig2ConfirmDirectArgs } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const params = parseMsig2ConfirmDirectArgs(new Args());
  const result = await confirmMsig2TransactionDirect(params);
  const observation = submissionObservation(result.transaction);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: params.wallet,
    action: "confirmTransaction",
    transactionId: params.transactionId,
    status: "accepted_by_jrpc",
    observation,
    confirmation: observation === "included" && result.transaction
      ? msig2ConfirmationOutcome(result.transaction)
      : undefined,
    result,
    transaction: result.transaction,
  });
});
