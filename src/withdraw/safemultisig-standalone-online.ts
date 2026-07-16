import type { ToncenterClient } from "../toncenter/client";
import type { ToncenterTransaction } from "../toncenter/types";
import {
  getMultisigPendingTransactions,
  getMultisigPendingTransactionsViaToncenter,
  multisigConfirmationOutcome,
  parseMultisigExternalBoc,
  sendMultisigDirect,
  waitForToncenterMultisigSubmission,
  type MultisigConfirmation,
  type MultisigPendingTransaction,
  type ParsedMultisigExternalBoc,
  type ToncenterMultisigPendingTransaction,
  type ToncenterMultisigSubmission,
} from "./multisig-standalone-online";
import {
  makeSafeMultisigConfirmCall,
  makeSafeMultisigWithdrawCall,
  SAFEMULTISIG_SPEC,
  type SafeMultisigConfirmParams,
  type SafeMultisigMethod,
  type SafeMultisigWalletWithdrawParams,
} from "./safemultisig-standalone-offline";

export type SafeMultisigPendingTransaction = Omit<MultisigPendingTransaction, "stateInit">;
export type ToncenterSafeMultisigSubmission = ToncenterMultisigSubmission;
export type ToncenterSafeMultisigPendingTransaction = ToncenterMultisigPendingTransaction;
export type SafeMultisigConfirmation = MultisigConfirmation;
export type ParsedSafeMultisigExternalBoc = ParsedMultisigExternalBoc;
export type SafeMultisigWalletDirectParams = Omit<
  SafeMultisigWalletWithdrawParams,
  "signatureId"
>;
export type SafeMultisigConfirmDirectParams = Omit<SafeMultisigConfirmParams, "signatureId">;

export async function sendSafeMultisigWalletDirect(
  params: SafeMultisigWalletDirectParams & { rpcEndpoint: string },
) {
  return sendMultisigDirect(SAFEMULTISIG_SPEC, params, makeSafeMultisigWithdrawCall(params));
}

export async function confirmSafeMultisigTransactionDirect(
  params: SafeMultisigConfirmDirectParams & { rpcEndpoint: string },
) {
  return sendMultisigDirect(SAFEMULTISIG_SPEC, params, makeSafeMultisigConfirmCall(params));
}

export async function getSafeMultisigPendingTransactions(params: {
  wallet: string;
  rpcEndpoint: string;
}) {
  return getMultisigPendingTransactions<SafeMultisigPendingTransaction>(
    SAFEMULTISIG_SPEC,
    params,
  );
}

export async function getSafeMultisigPendingTransactionsViaToncenter(
  client: ToncenterClient,
  wallet: string,
  limit = 50,
): Promise<ToncenterSafeMultisigPendingTransaction[]> {
  return getMultisigPendingTransactionsViaToncenter(SAFEMULTISIG_SPEC, client, wallet, limit);
}

export function safeMultisigConfirmationOutcome(
  transaction: ToncenterTransaction,
): SafeMultisigConfirmation {
  return multisigConfirmationOutcome(transaction);
}

export function parseSafeMultisigExternalBoc(
  boc: string,
  method: SafeMultisigMethod,
): ParsedSafeMultisigExternalBoc {
  return parseMultisigExternalBoc(SAFEMULTISIG_SPEC, boc, method);
}

export async function waitForToncenterSafeMultisigSubmission(
  client: ToncenterClient,
  wallet: string,
  messageHash: string,
  expireAt: number,
  method: SafeMultisigMethod,
): Promise<ToncenterSafeMultisigSubmission> {
  return waitForToncenterMultisigSubmission(
    SAFEMULTISIG_SPEC,
    client,
    wallet,
    messageHash,
    expireAt,
    method,
  );
}
