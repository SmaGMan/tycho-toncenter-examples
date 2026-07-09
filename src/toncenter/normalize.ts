import { Address } from "@ton/core";
import type { ToncenterMessage, ToncenterTransaction } from "./types";

export function normalizeAddress(value: string): string {
  return Address.parse(value).toRawString().toLowerCase();
}

export function rawAddressEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    return normalizeAddress(a) === normalizeAddress(b);
  } catch {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
}

export function getInMessage(transaction: ToncenterTransaction): ToncenterMessage | null | undefined {
  return transaction.in_msg ?? transaction.inMessage;
}

export function getOutMessages(transaction: ToncenterTransaction): ToncenterMessage[] {
  return transaction.out_msgs ?? transaction.outMessages ?? [];
}

export function getMessageBody(message: ToncenterMessage | null | undefined): string | undefined {
  return message?.message_content?.body ?? message?.messageContent?.body ?? message?.body ?? undefined;
}

export function getMessageDestination(message: ToncenterMessage | null | undefined): string | null | undefined {
  return message?.destination ?? message?.dst;
}
