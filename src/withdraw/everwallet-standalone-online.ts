import { getPublicKey } from "everscale-crypto";
import { Address } from "everscale-inpage-provider";
import * as nekoton from "nekoton-wasm";
import {
  EverWalletAccount,
  SimpleAccountsStorage,
} from "everscale-standalone-client/nodejs";

import { ToncenterClient } from "../toncenter/client";
import {
  EVER_WALLET_ABI,
  type EverWalletWithdrawParams,
} from "./everwallet-standalone-offline";
import { createStandaloneProvider } from "./standalone-provider";
import {
  readAbiV2SignedExternalMessageExpireAt,
  type ToncenterExternalBoc,
  waitForToncenterExternalBocSubmission,
} from "./toncenter-external-boc";

export type ParsedEverWalletExternalBoc = ToncenterExternalBoc & {
  input: Record<string, unknown>;
};

export type EverWalletDirectWithdrawParams = Pick<
  EverWalletWithdrawParams,
  "wallet" | "secretKey" | "recipient" | "amountNano" | "bounce" | "publicKey"
>;

export async function sendEverWalletDirect(
  params: EverWalletDirectWithdrawParams & { rpcEndpoint: string },
) {
  const publicKey = params.publicKey ?? getPublicKey(params.secretKey);
  const account = new EverWalletAccount(new Address(params.wallet));
  const accountsStorage = new SimpleAccountsStorage({ entries: [account] });
  const provider = await createStandaloneProvider(params.rpcEndpoint, {
    signer: { publicKey, secretKey: params.secretKey },
    accountsStorage,
  });

  return provider.rawApi.sendMessage({
    sender: params.wallet,
    recipient: params.recipient,
    amount: params.amountNano,
    bounce: params.bounce,
  });
}

/**
 * Validates a signed EverWallet sendTransaction BOC and extracts the metadata
 * needed to match it against Toncenter wallet history without a private key.
 */
export function parseEverWalletExternalBoc(boc: string): ParsedEverWalletExternalBoc {
  let message: ReturnType<typeof nekoton.parseMessageBase64Extended>;
  try {
    message = nekoton.parseMessageBase64Extended(boc);
  } catch {
    throw new Error("--boc must be a signed EverWallet external message");
  }

  if (message.msgType !== "ExtIn" || !message.dst || !message.body) {
    throw new Error("--boc must be a signed EverWallet external message with a destination and body");
  }

  let input: Record<string, unknown>;
  try {
    const decoded = nekoton.decodeInput(message.body, EVER_WALLET_ABI, "sendTransaction", false);
    if (!decoded) throw new Error("not decoded");
    input = decoded.input as Record<string, unknown>;
  } catch {
    throw new Error("--boc is not an EverWallet sendTransaction external message");
  }

  try {
    return {
      wallet: message.dst,
      messageHash: message.hash,
      expireAt: readAbiV2SignedExternalMessageExpireAt(message.body),
      input,
    };
  } catch {
    throw new Error("--boc has an unsupported EverWallet signed external-message body");
  }
}

export async function waitForToncenterEverWalletSubmission(
  client: ToncenterClient,
  message: ParsedEverWalletExternalBoc,
) {
  return waitForToncenterExternalBocSubmission(client, message);
}
