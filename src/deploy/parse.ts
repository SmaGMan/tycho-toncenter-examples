import { getPublicKey } from "everscale-crypto";

import { Args, hexArg, strip0x } from "../cli/args";
import { envOrArg, tychoRpcEndpoint } from "../cli/env";
import type {
  SafeMultisigAddressParams,
  SafeMultisigDeploymentParams,
} from "./safemultisig-offline";

export function parseSafeMultisigAddressArgs(args = new Args()): SafeMultisigAddressParams {
  const suppliedPublicKey = args.get("public-key");
  const explicitSecretKey = args.get("secret-key");
  const secretKey = explicitSecretKey ?? (
    suppliedPublicKey == null ? envOrArg(undefined, "SAFEMULTISIG_SECRET_KEY") : undefined
  );
  if (suppliedPublicKey == null && secretKey == null) {
    throw new Error("--public-key, --secret-key, or SAFEMULTISIG_SECRET_KEY is required");
  }

  const publicKey = suppliedPublicKey == null
    ? getPublicKey(secretKeyHex(secretKey!))
    : hexArg("public-key", suppliedPublicKey, 32);
  if (secretKey != null && getPublicKey(secretKeyHex(secretKey)) !== publicKey) {
    throw new Error("--public-key does not match --secret-key");
  }

  return { publicKey, workchain: parseWorkchain(args) };
}

export function parseSafeMultisigDeploymentArgs(
  args = new Args(),
): SafeMultisigDeploymentParams {
  const secretKey = envOrArg(args.get("secret-key"), "SAFEMULTISIG_SECRET_KEY");
  if (!secretKey) throw new Error("--secret-key or SAFEMULTISIG_SECRET_KEY is required");

  const ownersInput = args.get("owners");
  const owners = ownersInput == null
    ? undefined
    : ownersInput.split(",").map((owner, index) => {
      if (!owner.trim()) throw new Error(`--owners contains an empty item at position ${index + 1}`);
      return hexArg("owners", owner, 32);
    });

  const requiredConfirmations = args.positiveInt("required-confirmations");
  if (requiredConfirmations != null && requiredConfirmations > 32) {
    throw new Error("--required-confirmations must not exceed 32");
  }

  return {
    secretKey: secretKeyHex(secretKey),
    publicKey: optionalPublicKey(args),
    owners,
    requiredConfirmations,
    workchain: parseWorkchain(args),
    timeout: args.positiveInt("timeout"),
    signatureId: args.int("signature-id"),
  };
}

export function parseSafeMultisigDirectDeploymentArgs(args = new Args()) {
  if (args.flag("signature-id")) {
    throw new Error("--signature-id is not supported by the direct command; it is read from JRPC");
  }
  const { signatureId: _signatureId, ...deployment } = parseSafeMultisigDeploymentArgs(args);
  return { ...deployment, rpcEndpoint: tychoRpcEndpoint(args.get("rpc")) };
}

function optionalPublicKey(args: Args): string | undefined {
  const value = args.get("public-key");
  return value == null ? undefined : hexArg("public-key", value, 32);
}

function parseWorkchain(args: Args): number {
  const workchain = args.int("workchain") ?? 0;
  if (workchain < -128 || workchain > 127) {
    throw new Error("--workchain must be an integer from -128 to 127");
  }
  return workchain;
}

function secretKeyHex(value: string): string {
  const normalized = strip0x(value);
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("--secret-key must be 32 bytes of hex");
  }
  return normalized.toLowerCase();
}
