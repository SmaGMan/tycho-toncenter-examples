import { Args } from "../cli/args";
import { toncenterEndpoint, tychoRpcEndpoint } from "../cli/env";
import { ToncenterClient } from "../toncenter/client";
import {
  parseEverWalletDirectArgs,
  parseMsig2DirectConfirmArgs,
  parseMsig2WalletDirectArgs,
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

export function parseBocSendArgs(args = new Args()) {
  const boc = args.require("boc").trim();
  if (!boc) throw new Error("--boc is required");
  return { boc };
}

export function parseToncenterClient(args = new Args()): ToncenterClient {
  return new ToncenterClient(toncenterEndpoint(args.get("endpoint")));
}
