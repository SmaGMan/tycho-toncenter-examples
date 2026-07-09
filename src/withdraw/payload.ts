import { beginCell } from "@ton/core";

export function makeCommentPayload(value: string): string {
  return beginCell().storeUint(0, 32).storeStringTail(value).endCell().toBoc().toString("base64");
}
