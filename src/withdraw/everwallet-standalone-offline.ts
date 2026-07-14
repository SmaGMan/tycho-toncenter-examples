import { getPublicKey } from "everscale-crypto";
import { Address } from "everscale-inpage-provider";
import * as nekoton from "nekoton-wasm";

import { makeCommentPayload } from "./payload";

export type EverWalletWithdrawParams = {
  wallet: string;
  secretKey: string;
  recipient: string;
  amountNano: string;
  bounce: boolean;
  comment?: string;
  timeout?: number;
  signatureId?: number;
  includeStateInit?: boolean;
  publicKey?: string;
  nonce?: number;
};

export type BuiltEverWalletBoc = {
  boc: string;
  hash: string;
  expireAt: number;
  publicKey: string;
};

/**
 * Builds and signs an EverWallet external message using only local crypto and
 * the bundled Nekoton WASM. It does not create a client or contact a network.
 */
export function buildEverWalletBoc(params: EverWalletWithdrawParams): BuiltEverWalletBoc {
  const publicKey = params.publicKey ?? getPublicKey(params.secretKey);
  if (params.includeStateInit || params.nonce != null) {
    assertEverWalletAddressMatchesStateInit(params.wallet, publicKey, params.nonce);
  }

  const stateInit = params.includeStateInit ? makeEverWalletStateInit(publicKey, params.nonce).boc : undefined;
  const payload = params.comment ? makeCommentPayload(params.comment) : "";
  const unsigned = nekoton.createExternalMessage(
    new nekoton.ClockWithOffset(),
    params.wallet,
    EVER_WALLET_ABI,
    "sendTransaction",
    stateInit,
    {
      dest: params.recipient,
      value: params.amountNano,
      bounce: params.bounce,
      flags: 3,
      payload,
    },
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

export function assertEverWalletAddressMatchesStateInit(
  wallet: string,
  publicKey: string,
  nonce: number | undefined,
): void {
  const walletAddress = new Address(wallet);
  const workchain = parseWorkchain(walletAddress);
  const expected = new Address(`${workchain}:${makeEverWalletStateInit(publicKey, nonce).hash}`);

  if (expected.equals(walletAddress)) return;

  const nonceText = nonce == null ? "without nonce" : `with nonce ${nonce}`;
  throw new Error(
    [
      `sender wallet address does not match EverWallet state init ${nonceText}`,
      `wallet: ${walletAddress.toString()}`,
      `expected: ${expected.toString()}`,
      "Use the same --nonce that was used to compute --wallet, or omit --nonce for a standard EverWallet.",
    ].join("\n"),
  );
}

function parseWorkchain(address: Address): number {
  const [workchain] = address.toString().split(":");
  const parsed = Number(workchain);
  if (!Number.isInteger(parsed)) {
    throw new Error(`cannot parse workchain from wallet address: ${address.toString()}`);
  }
  return parsed;
}

function makeEverWalletStateInit(publicKey: string, nonce: number | undefined) {
  const structure = nonce == null ? EVER_WALLET_DATA_STRUCTURE : EVER_WALLET_DATA_STRUCTURE_EXT;
  const data = nekoton.packIntoCell(structure, {
    publicKey: BigInt(`0x${publicKey}`).toString(),
    timestamp: 0,
    ...(nonce == null ? {} : { nonce }),
  }).boc;
  return nekoton.mergeTvc(EVER_WALLET_CODE, data);
}

const EVER_WALLET_DATA_STRUCTURE = [
  { name: "publicKey", type: "uint256" },
  { name: "timestamp", type: "uint64" },
];

const EVER_WALLET_DATA_STRUCTURE_EXT = [
  ...EVER_WALLET_DATA_STRUCTURE,
  { name: "nonce", type: "uint32" },
];

const EVER_WALLET_CODE =
  "te6cckEBBgEA/AABFP8A9KQT9LzyyAsBAgEgAgMABNIwAubycdcBAcAA8nqDCNcY7UTQgwfXAdcLP8j4KM8WI88WyfkAA3HXAQHDAJqDB9cBURO68uBk3oBA1wGAINcBgCDXAVQWdfkQ8qj4I7vyeWa++COBBwiggQPoqFIgvLHydAIgghBM7mRsuuMPAcjL/8s/ye1UBAUAmDAC10zQ+kCDBtcBcdcBeNcB10z4AHCAEASqAhSxyMsFUAXPFlAD+gLLaSLQIc8xIddJoIQJuZgzcAHLAFjPFpcwcQHLABLM4skB+wAAPoIQFp4+EbqOEfgAApMg10qXeNcB1AL7AOjRkzLyPOI+zYS/";

export const EVER_WALLET_ABI = `{
  "ABI version": 2,
  "version": "2.3",
  "header": ["pubkey", "time", "expire"],
  "functions": [{
    "name": "sendTransaction",
    "inputs": [
      {"name":"dest","type":"address"},
      {"name":"value","type":"uint128"},
      {"name":"bounce","type":"bool"},
      {"name":"flags","type":"uint8"},
      {"name":"payload","type":"cell"}
    ],
    "outputs": []
  }],
  "events": []
}`;
