import { Args } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import {
  confirmSafeMultisigTransactionDirect,
  safeMultisigConfirmationOutcome,
} from "../../src/withdraw/safemultisig-standalone";
import { parseSafeMultisigConfirmDirectArgs } from "../../src/withdraw/parse";
import { submissionObservation } from "../../src/withdraw/transaction-observation";

runMain(async () => {
  const params = parseSafeMultisigConfirmDirectArgs(new Args());
  const result = await confirmSafeMultisigTransactionDirect(params);
  const observation = submissionObservation(result.transaction);
  printJson({
    transport: "everscale-standalone-client direct JRPC",
    wallet: params.wallet,
    action: "confirmTransaction",
    transactionId: params.transactionId,
    status: "accepted_by_jrpc",
    observation,
    confirmation: observation === "included" && result.transaction
      ? safeMultisigConfirmationOutcome(result.transaction)
      : undefined,
    result,
    transaction: result.transaction,
  });
});
