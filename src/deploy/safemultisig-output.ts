import { submissionObservation } from "../withdraw/transaction-observation";
import {
  SAFEMULTISIG_ARTIFACT,
  type BuiltSafeMultisigDeployment,
} from "./safemultisig-offline";
import type { SentSafeMultisigDeployment } from "./safemultisig-online";

export function formatToncenterSafeMultisigDeployment(
  sent: SentSafeMultisigDeployment,
  message?: BuiltSafeMultisigDeployment["message"],
) {
  return {
    transport: "toncenter sendBocReturnHash",
    wallet: sent.deployment.wallet,
    action: "constructor",
    status: "accepted_by_toncenter",
    observation: submissionObservation(sent.transaction),
    ...(message == null ? {} : { message }),
    messageHash: sent.deployment.messageHash,
    expireAt: sent.deployment.expireAt,
    expiresAt: sent.deployment.expireAt,
    codeHash: sent.deployment.codeHash,
    input: sent.deployment.input,
    artifact: SAFEMULTISIG_ARTIFACT,
    result: sent.result,
    transaction: sent.transaction,
  };
}
