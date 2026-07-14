import { Args, base64OrHexToBuffer, hexArg } from "../cli/args";
import { envOrArg } from "../cli/env";
import { toNanoString } from "./amount";

export function parseEverWalletDirectArgs(args = new Args()) {
  rejectArgs(args, ["comment", "timeout", "signature-id", "include-state-init", "nonce"]);
  return parseEverWalletTransferArgs(args);
}

function parseEverWalletTransferArgs(args: Args) {
  const wallet = requireArgOrEnv(args, "wallet", "EVERWALLET_ADDRESS");
  const secretKey = requireArgOrEnv(args, "secret-key", "EVERWALLET_SECRET_KEY");

  return {
    wallet,
    secretKey: hexArg("secret-key", secretKey),
    recipient: args.require("to"),
    amountNano: toNanoString(args.require("amount")),
    bounce: args.flag("bounce"),
    publicKey: optionalHexArg(args, "public-key", 32),
  };
}

export function parseEverWalletWithdrawArgs(args = new Args()) {
  return {
    ...parseEverWalletTransferArgs(args),
    comment: args.get("comment"),
    timeout: args.positiveInt("timeout"),
    signatureId: args.int("signature-id"),
    includeStateInit: args.flag("include-state-init"),
    nonce: args.int("nonce"),
  };
}

export function parseMsig2WalletDirectArgs(args = new Args()) {
  rejectArgs(args, ["signature-id"]);
  return parseMsig2WalletTransferArgs(args);
}

function parseMsig2WalletTransferArgs(args: Args) {
  return {
    ...parseMsig2SignerArgs(args),
    recipient: args.require("to"),
    amountNano: toNanoString(args.require("amount")),
    bounce: args.flag("bounce"),
    comment: args.get("comment"),
  };
}

export function parseMsig2WalletWithdrawArgs(args = new Args()) {
  return {
    ...parseMsig2WalletTransferArgs(args),
    signatureId: args.int("signature-id"),
  };
}

export function parseMsig2DirectConfirmArgs(args = new Args()) {
  rejectArgs(args, ["signature-id"]);
  return parseMsig2ConfirmationArgs(args);
}

function parseMsig2ConfirmationArgs(args: Args) {
  return {
    ...parseMsig2SignerArgs(args),
    transactionId: uint64StringArg("transaction-id", args.require("transaction-id")),
  };
}

export function parseMsig2ConfirmArgs(args = new Args()) {
  return {
    ...parseMsig2ConfirmationArgs(args),
    signatureId: args.int("signature-id"),
  };
}

export function parseTonCoreWalletV5WithdrawArgs(args = new Args()) {
  const wallet = envOrArg(args.get("wallet"), "TON_WALLET_ADDRESS");
  const secretKey = envOrArg(args.get("secret-key"), "TON_WALLET_SECRET_KEY");
  if (!secretKey) throw new Error("--secret-key or TON_WALLET_SECRET_KEY is required");

  return {
    wallet,
    secretKey: base64OrHexToBuffer("secret-key", secretKey, 64),
    recipient: args.require("to"),
    amountNano: toNanoString(args.require("amount")),
    bounce: args.flag("bounce"),
    seqno: args.int("seqno"),
    workchain: args.int("workchain"),
    networkGlobalId: args.int("network-global-id") ?? -239,
    subwalletNumber: args.int("subwallet-number"),
    signatureId: args.int("signature-id"),
    timeout: args.positiveInt("timeout"),
    sendMode: args.int("send-mode"),
    comment: args.get("comment"),
    includeStateInit: args.flag("include-state-init"),
  };
}

export function requireArgOrEnv(args: Args, argName: string, envName: string): string {
  const value = envOrArg(args.get(argName), envName);
  if (!value) throw new Error(`--${argName} or ${envName} is required`);
  return value;
}

function uint64StringArg(name: string, value: string): string {
  const trimmed = value.trim();
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(trimmed)) {
    throw new Error(`--${name} must be a uint64 decimal or 0x-prefixed hex value`);
  }

  const parsed = BigInt(trimmed);
  if (parsed < 0n || parsed > 0xffff_ffff_ffff_ffffn) {
    throw new Error(`--${name} must fit into uint64`);
  }
  return parsed.toString();
}

function parseMsig2SignerArgs(args: Args) {
  const secretKey = requireArgOrEnv(args, "secret-key", "MSIG2_SECRET_KEY");
  return {
    wallet: requireArgOrEnv(args, "wallet", "MSIG2_WALLET_ADDRESS"),
    secretKey: hexArg("secret-key", secretKey),
    timeout: args.positiveInt("timeout"),
    publicKey: optionalHexArg(args, "public-key", 32),
  };
}

function optionalHexArg(args: Args, name: string, bytes?: number): string | undefined {
  const value = args.get(name);
  return value == null ? undefined : hexArg(name, value, bytes);
}

function rejectArgs(args: Args, names: string[]): void {
  const unsupported = names.find(name => args.flag(name));
  if (unsupported) throw new Error(`--${unsupported} is not supported by this command`);
}
