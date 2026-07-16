import { Cell, contractAddress, loadMessage } from "@ton/core";
import * as nekoton from "nekoton-wasm";

import { ToncenterClient } from "../toncenter/client";
import { rawAddressEquals } from "../toncenter/normalize";
import type { ToncenterTransaction } from "../toncenter/types";
import { SAFEMULTISIG_ABI } from "../withdraw/safemultisig-standalone-offline";
import { createStandaloneProvider } from "../withdraw/standalone-provider";
import {
  readAbiV2SignedExternalMessageExpireAt,
  waitForToncenterExternalBocSubmission,
} from "../withdraw/toncenter-external-boc";
import {
  prepareSafeMultisigDeployment,
  resolveSafeMultisigDeploymentPublicKey,
  safeMultisigConstructorInput,
  SAFEMULTISIG_ARTIFACT,
  type SafeMultisigDeploymentParams,
} from "./safemultisig-offline";

export type ParsedSafeMultisigDeployment = {
  wallet: string;
  messageHash: string;
  expireAt: number;
  codeHash: string;
  input: {
    owners: string[];
    reqConfirms: number;
  };
};

export type SentSafeMultisigDeployment = {
  deployment: ParsedSafeMultisigDeployment;
  result: Awaited<ReturnType<ToncenterClient["sendBocReturnHash"]>>;
  transaction?: ToncenterTransaction;
};

export async function deploySafeMultisigDirect(
  params: Omit<SafeMultisigDeploymentParams, "signatureId"> & { rpcEndpoint: string },
) {
  const publicKey = resolveSafeMultisigDeploymentPublicKey(params.secretKey, params.publicKey);
  const deployment = prepareSafeMultisigDeployment({ ...params, publicKey });
  const provider = await createStandaloneProvider(params.rpcEndpoint, {
    signer: { publicKey, secretKey: params.secretKey },
    message: { timeout: params.timeout ?? 30, retryCount: 1 },
  });
  const { state } = await provider.rawApi.getFullContractState({ address: deployment.wallet });
  if (state?.isDeployed) {
    throw new Error(`SafeMultisig address is already deployed: ${deployment.wallet}`);
  }
  if (state == null || BigInt(state.balance) <= 0n) {
    throw new Error(`fund the future SafeMultisig address before deployment: ${deployment.wallet}`);
  }

  const result = await provider.rawApi.sendExternalMessage({
    publicKey,
    recipient: deployment.wallet,
    stateInit: deployment.stateInit,
    payload: {
      abi: SAFEMULTISIG_ABI,
      method: "constructor",
      params: safeMultisigConstructorInput(deployment),
    },
  });
  const { stateInit: _stateInit, ...summary } = deployment;
  return { deployment: summary, balanceBefore: state.balance, ...result };
}

/** Validates and decodes a SafeMultisig constructor BOC without a network request. */
export function parseSafeMultisigDeploymentBoc(boc: string): ParsedSafeMultisigDeployment {
  const message = nekoton.parseMessageBase64Extended(boc);
  if (message.msgType !== "ExtIn" || !message.dst || !message.body) {
    throw new Error("--boc must be a signed external SafeMultisig constructor message");
  }

  const tonMessage = loadMessage(Cell.fromBase64(boc).beginParse());
  if (tonMessage.info.type !== "external-in" || !tonMessage.init?.code) {
    throw new Error("--boc must include SafeMultisig state init");
  }

  const codeHash = tonMessage.init.code.hash().toString("hex");
  if (codeHash !== SAFEMULTISIG_ARTIFACT.codeHash) {
    throw new Error(`--boc has unexpected SafeMultisig code hash ${codeHash}`);
  }

  const stateInitAddress = contractAddress(tonMessage.info.dest.workChain, tonMessage.init).toRawString();
  if (!rawAddressEquals(message.dst, stateInitAddress)) {
    throw new Error("--boc destination does not match its SafeMultisig state init");
  }

  let decoded: ReturnType<typeof decodeConstructorInput>;
  try {
    const input = nekoton.decodeInput(message.body, SAFEMULTISIG_ABI, "constructor", false)?.input;
    if (!input) throw new Error("not decoded");
    decoded = decodeConstructorInput(input as Record<string, unknown>);
  } catch {
    throw new Error("--boc is not a SafeMultisig constructor external message");
  }

  return {
    wallet: message.dst,
    messageHash: message.hash,
    expireAt: readAbiV2SignedExternalMessageExpireAt(message.body),
    codeHash,
    input: decoded,
  };
}

export async function sendSafeMultisigDeploymentBoc(
  client: ToncenterClient,
  boc: string,
): Promise<SentSafeMultisigDeployment> {
  const deployment = parseSafeMultisigDeploymentBoc(boc);
  const result = await client.sendBocReturnHash(boc);
  const submission = await waitForToncenterExternalBocSubmission(client, {
    wallet: deployment.wallet,
    messageHash: deployment.messageHash,
    expireAt: deployment.expireAt,
  });
  return { deployment, result, transaction: submission.transaction };
}

function decodeConstructorInput(input: Record<string, unknown>) {
  if (!Array.isArray(input.owners)) throw new Error("owners are missing");
  const owners = input.owners.map(owner => uint256Hex(owner));
  const reqConfirms = Number(uintString(input.reqConfirms));
  if (!Number.isInteger(reqConfirms) || reqConfirms < 1 || reqConfirms > owners.length) {
    throw new Error("invalid required confirmation count");
  }
  return { owners, reqConfirms };
}

function uint256Hex(value: unknown): string {
  const parsed = BigInt(uintString(value));
  if (parsed < 0n || parsed >= 1n << 256n) throw new Error("owner does not fit uint256");
  return parsed.toString(16).padStart(64, "0");
}

function uintString(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("expected an unsigned integer");
  }
  const normalized = String(value);
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(normalized)) {
    throw new Error("expected an unsigned integer");
  }
  return normalized;
}
