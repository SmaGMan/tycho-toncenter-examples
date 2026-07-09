import { getInMessage, getMessageDestination, getOutMessages, rawAddressEquals } from "../toncenter/normalize";
import type { ToncenterTransaction } from "../toncenter/types";

export type DepositMatchOptions = {
  depositAddress: string;
  requireNotAborted?: boolean;
};

export type DepositMatch = {
  account: string | undefined;
  hash: string | undefined;
  lt: string | number | undefined;
  now: number | undefined;
  value: string | number | undefined;
  source: string | null | undefined;
  destination: string | null | undefined;
  aborted: boolean | undefined;
};

export function isDepositTransaction(tx: ToncenterTransaction, options: DepositMatchOptions): boolean {
  const inMsg = getInMessage(tx);
  if (!inMsg) return false;
  if (inMsg.bounced !== false) return false;
  if (!rawAddressEquals(getMessageDestination(inMsg), options.depositAddress)) return false;
  if (!rawAddressEquals(tx.account ?? tx.account_addr, options.depositAddress)) return false;
  if (getOutMessages(tx).length !== 0) return false;
  if (options.requireNotAborted && tx.aborted !== false) return false;
  return true;
}

export function toDepositMatch(tx: ToncenterTransaction): DepositMatch {
  const inMsg = getInMessage(tx);
  return {
    account: tx.account ?? tx.account_addr,
    hash: tx.hash,
    lt: tx.lt,
    now: tx.now,
    value: inMsg?.value,
    source: inMsg?.source ?? inMsg?.src,
    destination: getMessageDestination(inMsg),
    aborted: tx.aborted,
  };
}
