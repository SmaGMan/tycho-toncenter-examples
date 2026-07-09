import { Args, base64OrHexToBuffer, hexArg } from "../cli/args";
import { envOrArg, toncenterEndpoint, tychoRpcEndpoint } from "../cli/env";
import { ToncenterClient } from "../toncenter/client";
import { toNanoString } from "./amount";

export function parseEverWalletWithdrawArgs(args = new Args()) {
  const wallet = requireArgOrEnv(args, "wallet", "EVERWALLET_ADDRESS");
  const secretKey = requireArgOrEnv(args, "secret-key", "EVERWALLET_SECRET_KEY");

  return {
    wallet,
    secretKey: hexArg("secret-key", secretKey),
    recipient: args.require("to"),
    amountNano: toNanoString(args.require("amount")),
    bounce: args.flag("bounce"),
    comment: args.get("comment"),
    timeout: args.positiveInt("timeout"),
    signatureId: args.int("signature-id"),
    includeStateInit: args.flag("include-state-init"),
    publicKey: optionalHexArg(args, "public-key", 32),
    nonce: args.int("nonce"),
  };
}

export function parseStandaloneDirectArgs(args = new Args()) {
  return {
    ...parseEverWalletWithdrawArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2WalletWithdrawArgs(args = new Args()) {
  return {
    ...parseMsig2SignerArgs(args),
    recipient: args.require("to"),
    amountNano: toNanoString(args.require("amount")),
    bounce: args.flag("bounce"),
    comment: args.get("comment"),
  };
}

export function parseMsig2StandaloneDirectArgs(args = new Args()) {
  return {
    ...parseMsig2WalletWithdrawArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2ConfirmArgs(args = new Args()) {
  return {
    ...parseMsig2SignerArgs(args),
    transactionId: uint64StringArg("transaction-id", args.require("transaction-id")),
  };
}

export function parseMsig2ConfirmDirectArgs(args = new Args()) {
  return {
    ...parseMsig2ConfirmArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2PendingDirectArgs(args = new Args()) {
  return {
    wallet: requireArgOrEnv(args, "wallet", "MSIG2_WALLET_ADDRESS"),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2PendingToncenterArgs(args = new Args()) {
  return {
    wallet: requireArgOrEnv(args, "wallet", "MSIG2_WALLET_ADDRESS"),
    limit: args.positiveInt("limit") ?? 50,
  };
}

export function parseToncenterClient(args = new Args()): ToncenterClient {
  return new ToncenterClient(toncenterEndpoint(args.get("endpoint")));
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
    signatureId: args.int("signature-id"),
    publicKey: optionalHexArg(args, "public-key", 32),
  };
}

function requireArgOrEnv(args: Args, argName: string, envName: string): string {
  const value = envOrArg(args.get(argName), envName);
  if (!value) throw new Error(`--${argName} or ${envName} is required`);
  return value;
}

function optionalHexArg(args: Args, name: string, bytes?: number): string | undefined {
  const value = args.get(name);
  return value == null ? undefined : hexArg(name, value, bytes);
}
