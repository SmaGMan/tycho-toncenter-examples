import { getPublicKey } from "everscale-crypto";
import * as nekoton from "nekoton-wasm";

import { makeCommentPayload } from "./payload";

export type MultisigSignerParams = {
  wallet: string;
  secretKey: string;
  timeout?: number;
  signatureId?: number;
  publicKey?: string;
};

export type MultisigWalletWithdrawParams = MultisigSignerParams & {
  recipient: string;
  amountNano: string;
  bounce: boolean;
  comment?: string;
};

export type MultisigConfirmParams = MultisigSignerParams & {
  transactionId: string;
};

export type MultisigMethod = "submitTransaction" | "confirmTransaction";

export type MultisigCall = {
  method: MultisigMethod;
  params: Record<string, string | number | boolean | null>;
};

export type BuiltMultisigWalletBoc = {
  boc: string;
  hash: string;
  expireAt: number;
  publicKey: string;
};

export type MultisigContractSpec = {
  name: string;
  abi: string;
  submitStateInit: boolean;
  minimumAmount?: {
    nano: bigint;
    display: string;
  };
};

export function makeMultisigWithdrawCall(
  spec: MultisigContractSpec,
  params: MultisigWalletWithdrawParams,
): MultisigCall {
  if (spec.minimumAmount != null && BigInt(params.amountNano) < spec.minimumAmount.nano) {
    throw new Error(
      `${spec.name} --amount must be at least ${spec.minimumAmount.display} native tokens`,
    );
  }

  return {
    method: "submitTransaction",
    params: {
      dest: params.recipient,
      value: params.amountNano,
      bounce: params.bounce,
      allBalance: false,
      payload: params.comment ? makeCommentPayload(params.comment) : "",
      ...(spec.submitStateInit ? { stateInit: null } : {}),
    },
  };
}

export function makeMultisigConfirmCall(params: MultisigConfirmParams): MultisigCall {
  return {
    method: "confirmTransaction",
    params: { transactionId: params.transactionId },
  };
}

export function buildMultisigBoc(
  spec: MultisigContractSpec,
  params: MultisigSignerParams,
  call: MultisigCall,
): BuiltMultisigWalletBoc {
  const publicKey = resolveMultisigPublicKey(params);
  const unsigned = nekoton.createExternalMessage(
    new nekoton.ClockWithOffset(),
    params.wallet,
    spec.abi,
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

export function resolveMultisigPublicKey(params: {
  secretKey: string;
  publicKey?: string;
}): string {
  const derivedPublicKey = getPublicKey(params.secretKey).toLowerCase();
  if (params.publicKey != null && params.publicKey.toLowerCase() !== derivedPublicKey) {
    throw new Error("--public-key does not match --secret-key");
  }
  return derivedPublicKey;
}
