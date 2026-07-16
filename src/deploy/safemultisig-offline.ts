import { getPublicKey } from "everscale-crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as nekoton from "nekoton-wasm";

import { SAFEMULTISIG_ABI } from "../withdraw/safemultisig-standalone-offline";

export const SAFEMULTISIG_ARTIFACT = {
  commit: "5ee039e4d093b91b6fdf7d77b9627e2e7d37f000",
  source: "https://github.com/tonlabs/ton-labs-contracts/tree/5ee039e4d093b91b6fdf7d77b9627e2e7d37f000/solidity/safemultisig",
  tvcBocHash: "6dc5dcb2bbdfe497a8706f6bc52aab8a0bc943b7994978772af723ceb516933f",
  codeHash: "80d6c47c4a25543c9b397b71716f3fae1e2c5d247174c52e2c19bd896442b105",
} as const;

export type SafeMultisigAddressParams = {
  publicKey: string;
  workchain?: number;
};

export type SafeMultisigConstructorParams = SafeMultisigAddressParams & {
  owners?: string[];
  requiredConfirmations?: number;
};

export type SafeMultisigDeploymentParams = Omit<SafeMultisigConstructorParams, "publicKey"> & {
  secretKey: string;
  publicKey?: string;
  timeout?: number;
  signatureId?: number;
};

export type SafeMultisigDeploymentAddress = {
  wallet: string;
  workchain: number;
  publicKey: string;
  stateInitHash: string;
  codeHash: string;
};

export type PreparedSafeMultisigDeployment = SafeMultisigDeploymentAddress & {
  owners: string[];
  requiredConfirmations: number;
  stateInit: string;
};

export type BuiltSafeMultisigDeployment = Omit<
  PreparedSafeMultisigDeployment,
  "stateInit" | "publicKey"
> & {
  message: {
    boc: string;
    hash: string;
    expireAt: number;
    publicKey: string;
  };
};

let verifiedTvc: string | undefined;

/** Derives the future wallet address locally. Constructor arguments do not affect it. */
export function deriveSafeMultisigAddress(
  params: SafeMultisigAddressParams,
): SafeMultisigDeploymentAddress {
  const { stateInit: _stateInit, ...address } = deriveSafeMultisigStateInit(params);
  return address;
}

/** Prepares constructor params and state init locally for any deployment transport. */
export function prepareSafeMultisigDeployment(
  params: SafeMultisigConstructorParams,
): PreparedSafeMultisigDeployment {
  const derived = deriveSafeMultisigStateInit(params);
  const owners = normalizeOwners(params.owners ?? [derived.publicKey]);
  const requiredConfirmations = resolveRequiredConfirmations(
    params.requiredConfirmations,
    owners.length,
  );
  return {
    ...derived,
    owners,
    requiredConfirmations,
  };
}

/** Builds and signs a constructor BOC without making a network request. */
export function buildSafeMultisigDeployment(
  params: SafeMultisigDeploymentParams,
): BuiltSafeMultisigDeployment {
  const publicKey = resolveSafeMultisigDeploymentPublicKey(params.secretKey, params.publicKey);
  const prepared = prepareSafeMultisigDeployment({ ...params, publicKey });
  const unsigned = nekoton.createExternalMessage(
    new nekoton.ClockWithOffset(),
    prepared.wallet,
    SAFEMULTISIG_ABI,
    "constructor",
    prepared.stateInit,
    safeMultisigConstructorInput(prepared),
    publicKey,
    params.timeout ?? 60,
  );

  try {
    const signature = nekoton.ed25519_sign(params.secretKey, unsigned.hash, params.signatureId);
    const signed = unsigned.sign(signature);
    const { stateInit: _stateInit, publicKey: _publicKey, ...deployment } = prepared;
    return {
      ...deployment,
      message: {
        boc: signed.boc,
        hash: signed.hash,
        expireAt: signed.expireAt,
        publicKey,
      },
    };
  } finally {
    unsigned.free();
  }
}

export function safeMultisigConstructorInput(
  prepared: Pick<PreparedSafeMultisigDeployment, "owners" | "requiredConfirmations">,
) {
  return {
    owners: prepared.owners.map(owner => `0x${owner}`),
    reqConfirms: prepared.requiredConfirmations,
  };
}

export function resolveSafeMultisigDeploymentPublicKey(
  secretKey: string,
  supplied?: string,
): string {
  const derived = getPublicKey(secretKey).toLowerCase();
  const publicKey = supplied == null ? derived : publicKeyHex(supplied);
  if (publicKey !== derived) throw new Error("--public-key does not match --secret-key");
  return derived;
}

function expectedAddress(publicKey: string, workchain: number): nekoton.ExpectedAddress {
  return nekoton.getExpectedAddress(
    loadVerifiedSafeMultisigTvc(),
    SAFEMULTISIG_ABI,
    workchain,
    publicKey,
    {},
  );
}

function deriveSafeMultisigStateInit(
  params: SafeMultisigAddressParams,
): SafeMultisigDeploymentAddress & { stateInit: string } {
  const publicKey = publicKeyHex(params.publicKey);
  const workchain = params.workchain ?? 0;
  const expected = expectedAddress(publicKey, workchain);
  return {
    wallet: expected.address,
    workchain,
    publicKey,
    stateInitHash: expected.hash,
    codeHash: SAFEMULTISIG_ARTIFACT.codeHash,
    stateInit: expected.stateInit,
  };
}

function loadVerifiedSafeMultisigTvc(): string {
  if (verifiedTvc != null) return verifiedTvc;

  const path = resolve(__dirname, "../../artifacts/safemultisig/SafeMultisigWallet.tvc.b64");
  const tvc = readFileSync(path, "utf8").trim();
  if (nekoton.getBocHash(tvc) !== SAFEMULTISIG_ARTIFACT.tvcBocHash) {
    throw new Error(`SafeMultisig TVC hash mismatch: ${path}`);
  }

  const code = nekoton.splitTvc(tvc).code;
  if (!code || nekoton.getBocHash(code) !== SAFEMULTISIG_ARTIFACT.codeHash) {
    throw new Error(`SafeMultisig code hash mismatch: ${path}`);
  }

  verifiedTvc = tvc;
  return tvc;
}

function normalizeOwners(input: string[]): string[] {
  if (input.length === 0 || input.length > 32) {
    throw new Error("--owners must contain from 1 to 32 public keys");
  }

  const owners = input.map(publicKeyHex);
  if (new Set(owners).size !== owners.length) {
    throw new Error("--owners must not contain duplicate public keys");
  }
  return owners;
}

function resolveRequiredConfirmations(value: number | undefined, ownerCount: number): number {
  if (value == null) {
    if (ownerCount === 1) return 1;
    throw new Error("--required-confirmations is required when --owners contains multiple keys");
  }
  if (!Number.isInteger(value) || value < 1 || value > ownerCount) {
    throw new Error(`--required-confirmations must be from 1 to ${ownerCount}`);
  }
  return value;
}

function publicKeyHex(value: string): string {
  const normalized = value.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("public key must be 32 bytes of hex");
  }
  return normalized;
}
