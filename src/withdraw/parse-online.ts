import { Args } from "../cli/args";
import { toncenterEndpoint, tychoRpcEndpoint } from "../cli/env";
import { ToncenterClient } from "../toncenter/client";
import {
  parseEverWalletDirectArgs,
  parseMsig2DirectConfirmArgs,
  parseMsig2WalletDirectArgs,
  parseSafeMultisigDirectConfirmArgs,
  parseSafeMultisigWalletDirectArgs,
  requireArgOrEnv,
} from "./parse-offline";

export function parseStandaloneDirectArgs(args = new Args()) {
  return {
    ...parseEverWalletDirectArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2StandaloneDirectArgs(args = new Args()) {
  return {
    ...parseMsig2WalletDirectArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2ConfirmDirectArgs(args = new Args()) {
  return {
    ...parseMsig2DirectConfirmArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseMsig2PendingDirectArgs(args = new Args()) {
  return parseMultisigPendingDirectArgs(args, "MSIG2_WALLET_ADDRESS");
}

export function parseMsig2PendingToncenterArgs(args = new Args()) {
  return parseMultisigPendingToncenterArgs(args, "MSIG2_WALLET_ADDRESS");
}

export function parseSafeMultisigStandaloneDirectArgs(args = new Args()) {
  return {
    ...parseSafeMultisigWalletDirectArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseSafeMultisigConfirmDirectArgs(args = new Args()) {
  return {
    ...parseSafeMultisigDirectConfirmArgs(args),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

export function parseSafeMultisigPendingDirectArgs(args = new Args()) {
  return parseMultisigPendingDirectArgs(args, "SAFEMULTISIG_WALLET_ADDRESS");
}

export function parseSafeMultisigPendingToncenterArgs(args = new Args()) {
  return parseMultisigPendingToncenterArgs(args, "SAFEMULTISIG_WALLET_ADDRESS");
}

function parseMultisigPendingDirectArgs(args: Args, walletEnv: string) {
  return {
    wallet: requireArgOrEnv(args, "wallet", walletEnv),
    rpcEndpoint: tychoRpcEndpoint(args.get("rpc")),
  };
}

function parseMultisigPendingToncenterArgs(args: Args, walletEnv: string) {
  return {
    wallet: requireArgOrEnv(args, "wallet", walletEnv),
    limit: args.positiveInt("limit") ?? 50,
  };
}

export function parseBocSendArgs(args = new Args()) {
  const boc = args.require("boc").trim();
  if (!boc) throw new Error("--boc is required");
  return { boc };
}

export function parseToncenterClient(args = new Args()): ToncenterClient {
  return new ToncenterClient(toncenterEndpoint(args.get("endpoint")));
}
