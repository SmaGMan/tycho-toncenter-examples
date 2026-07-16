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
  makeMsig2ConfirmCall,
  makeMsig2WithdrawCall,
  MSIG2_SPEC,
  type Msig2ConfirmParams,
  type Msig2Method,
  type Msig2WalletWithdrawParams,
} from "./msig2-standalone-offline";

export type Msig2PendingTransaction = MultisigPendingTransaction & {
  stateInit: string | null;
};
export type ToncenterMsig2Submission = ToncenterMultisigSubmission;
export type ToncenterMsig2PendingTransaction = ToncenterMultisigPendingTransaction;
export type Msig2Confirmation = MultisigConfirmation;
export type ParsedMsig2ExternalBoc = ParsedMultisigExternalBoc;
export type Msig2WalletDirectParams = Omit<Msig2WalletWithdrawParams, "signatureId">;
export type Msig2ConfirmDirectParams = Omit<Msig2ConfirmParams, "signatureId">;

export async function sendMsig2WalletDirect(
  params: Msig2WalletDirectParams & { rpcEndpoint: string },
) {
  return sendMultisigDirect(MSIG2_SPEC, params, makeMsig2WithdrawCall(params));
}

export async function confirmMsig2TransactionDirect(
  params: Msig2ConfirmDirectParams & { rpcEndpoint: string },
) {
  return sendMultisigDirect(MSIG2_SPEC, params, makeMsig2ConfirmCall(params));
}

export async function getMsig2PendingTransactions(params: {
  wallet: string;
  rpcEndpoint: string;
}) {
  return getMultisigPendingTransactions<Msig2PendingTransaction>(MSIG2_SPEC, params);
}

export async function getMsig2PendingTransactionsViaToncenter(
  client: ToncenterClient,
  wallet: string,
  limit = 50,
): Promise<ToncenterMsig2PendingTransaction[]> {
  return getMultisigPendingTransactionsViaToncenter(MSIG2_SPEC, client, wallet, limit);
}

export function msig2ConfirmationOutcome(transaction: ToncenterTransaction): Msig2Confirmation {
  return multisigConfirmationOutcome(transaction);
}

export function parseMsig2ExternalBoc(
  boc: string,
  method: Msig2Method,
): ParsedMsig2ExternalBoc {
  return parseMultisigExternalBoc(MSIG2_SPEC, boc, method);
}

export async function waitForToncenterMsig2Submission(
  client: ToncenterClient,
  wallet: string,
  messageHash: string,
  expireAt: number,
  method: Msig2Method,
): Promise<ToncenterMsig2Submission> {
  return waitForToncenterMultisigSubmission(
    MSIG2_SPEC,
    client,
    wallet,
    messageHash,
    expireAt,
    method,
  );
}
