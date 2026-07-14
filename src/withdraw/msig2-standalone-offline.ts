import { getPublicKey } from "everscale-crypto";
import * as nekoton from "nekoton-wasm";

import { makeCommentPayload } from "./payload";

export type Msig2SignerParams = {
  wallet: string;
  secretKey: string;
  timeout?: number;
  signatureId?: number;
  publicKey?: string;
};

export type Msig2WalletWithdrawParams = Msig2SignerParams & {
  recipient: string;
  amountNano: string;
  bounce: boolean;
  comment?: string;
};

export type Msig2ConfirmParams = Msig2SignerParams & {
  transactionId: string;
};

export type Msig2Method = "submitTransaction" | "confirmTransaction";

export type Msig2Call = {
  method: Msig2Method;
  params: Record<string, string | number | boolean | null>;
};

export type BuiltMsigWalletBoc = {
  boc: string;
  hash: string;
  expireAt: number;
  publicKey: string;
};

/**
 * Builds and signs multisig2 external messages with local crypto and bundled
 * Nekoton WASM only. No transport or account-state request is created here.
 */
export function buildMsig2WalletBoc(params: Msig2WalletWithdrawParams): BuiltMsigWalletBoc {
  return buildMsig2Boc(params, makeMsig2WithdrawCall(params));
}

export function buildMsig2ConfirmBoc(params: Msig2ConfirmParams): BuiltMsigWalletBoc {
  return buildMsig2Boc(params, makeMsig2ConfirmCall(params));
}

export function makeMsig2WithdrawCall(params: Msig2WalletWithdrawParams): Msig2Call {
  return {
    method: "submitTransaction",
    params: {
      dest: params.recipient,
      value: params.amountNano,
      bounce: params.bounce,
      allBalance: false,
      payload: params.comment ? makeCommentPayload(params.comment) : "",
      stateInit: null,
    },
  };
}

export function makeMsig2ConfirmCall(params: Msig2ConfirmParams): Msig2Call {
  return {
    method: "confirmTransaction",
    params: { transactionId: params.transactionId },
  };
}

function buildMsig2Boc(params: Msig2SignerParams, call: Msig2Call): BuiltMsigWalletBoc {
  const publicKey = params.publicKey ?? getPublicKey(params.secretKey);
  const unsigned = nekoton.createExternalMessage(
    new nekoton.ClockWithOffset(),
    params.wallet,
    MSIG2_ABI,
    call.method,
    undefined,
    call.params,
    publicKey,
    params.timeout ?? 60,
  );

  try {
    const signature = nekoton.ed25519_sign(params.secretKey, unsigned.hash, params.signatureId);
    const signed = unsigned.sign(signature);
    return {
      boc: signed.boc,
      hash: signed.hash,
      expireAt: signed.expireAt,
      publicKey,
    };
  } finally {
    unsigned.free();
  }
}

export const MSIG2_ABI = `{
  "ABI version": 2,
  "version": "2.3",
  "header": ["pubkey", "time", "expire"],
  "functions": [{
    "name": "submitTransaction",
    "inputs": [
      {"name":"dest","type":"address"},
      {"name":"value","type":"uint128"},
      {"name":"bounce","type":"bool"},
      {"name":"allBalance","type":"bool"},
      {"name":"payload","type":"cell"},
      {"name":"stateInit","type":"optional(cell)"}
    ],
    "outputs": [
      {"name":"transId","type":"uint64"}
    ]
  }, {
    "name": "confirmTransaction",
    "inputs": [
      {"name":"transactionId","type":"uint64"}
    ],
    "outputs": []
  }, {
    "name": "getCustodians",
    "inputs": [],
    "outputs": [{
      "name":"custodians",
      "type":"tuple[]",
      "components":[
        {"name":"index","type":"uint8"},
        {"name":"pubkey","type":"uint256"}
      ]
    }]
  }, {
    "name": "getTransactions",
    "inputs": [],
    "outputs": [{
      "name":"transactions",
      "type":"tuple[]",
      "components":[
        {"name":"id","type":"uint64"},
        {"name":"confirmationsMask","type":"uint32"},
        {"name":"signsRequired","type":"uint8"},
        {"name":"signsReceived","type":"uint8"},
        {"name":"creator","type":"uint256"},
        {"name":"index","type":"uint8"},
        {"name":"dest","type":"address"},
        {"name":"value","type":"uint128"},
        {"name":"sendFlags","type":"uint16"},
        {"name":"payload","type":"cell"},
        {"name":"bounce","type":"bool"},
        {"name":"stateInit","type":"optional(cell)"}
      ]
    }]
  }],
  "events": []
}`;
