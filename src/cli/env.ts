import "dotenv/config";

export const DEFAULT_TONCENTER_ENDPOINT = "https://toncenter-testnet.tychoprotocol.com";
export const DEFAULT_TYCHO_RPC = "https://rpc-testnet.tychoprotocol.com";

export function toncenterEndpoint(input?: string): string {
  return input ?? process.env.TYCHO_TESTNET_TONCENTER_ENDPOINT ?? DEFAULT_TONCENTER_ENDPOINT;
}

export function tychoRpcEndpoint(input?: string): string {
  return input ?? process.env.TYCHO_TESTNET_RPC ?? DEFAULT_TYCHO_RPC;
}

export function envOrArg(argValue: string | undefined, envName: string): string | undefined {
  return argValue ?? process.env[envName];
}
