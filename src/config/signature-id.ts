import { Cell, Dictionary } from "@ton/core";

export const CAP_SIGNATURE_WITH_ID_BIT = 26n;
export const CAP_SIGNATURE_WITH_ID_MASK = 1n << CAP_SIGNATURE_WITH_ID_BIT;

export type BlockchainConfigResponse = {
  globalId: number;
  seqno?: number;
  config: string;
  [key: string]: unknown;
};

export type SignatureIdInfo = {
  globalId: number;
  seqno?: number;
  configAddress: string;
  globalVersion: number;
  capabilities: string;
  capabilitiesHex: string;
  capSignatureWithId: boolean;
  signatureIdRequired: boolean;
  signatureId: number | null;
};

export async function fetchBlockchainConfig(rpc: string): Promise<BlockchainConfigResponse> {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBlockchainConfig",
      params: {},
    }),
  });

  const text = await response.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`getBlockchainConfig returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`getBlockchainConfig failed: ${response.status} ${JSON.stringify(json)}`);
  }
  if (json.error) {
    throw new Error(`getBlockchainConfig failed: ${JSON.stringify(json.error)}`);
  }

  const result = json.result ?? json;
  if (!result || typeof result !== "object") {
    throw new Error(`getBlockchainConfig returned invalid result: ${JSON.stringify(json)}`);
  }
  if (!Number.isInteger(result.globalId)) {
    throw new Error(`getBlockchainConfig result has invalid globalId: ${JSON.stringify(result)}`);
  }
  if (typeof result.config !== "string") {
    throw new Error(`getBlockchainConfig result has invalid config BOC: ${JSON.stringify(result)}`);
  }

  return result as BlockchainConfigResponse;
}

export function readSignatureIdInfo(config: BlockchainConfigResponse): SignatureIdInfo {
  const parsed = parseBlockchainConfigGlobalVersion(config.config);
  const capSignatureWithId = (parsed.capabilities & CAP_SIGNATURE_WITH_ID_MASK) !== 0n;

  return {
    globalId: config.globalId,
    seqno: config.seqno,
    configAddress: parsed.configAddress,
    globalVersion: parsed.globalVersion,
    capabilities: parsed.capabilities.toString(),
    capabilitiesHex: `0x${parsed.capabilities.toString(16)}`,
    capSignatureWithId,
    signatureIdRequired: capSignatureWithId,
    signatureId: capSignatureWithId ? config.globalId : null,
  };
}

export function parseBlockchainConfigGlobalVersion(configBocBase64: string): {
  configAddress: string;
  globalVersion: number;
  capabilities: bigint;
} {
  const root = Cell.fromBase64(configBocBase64);
  const cs = root.beginParse();
  const configAddress = cs.loadBuffer(32).toString("hex");
  const params = Dictionary.loadDirect(
    Dictionary.Keys.Uint(32),
    Dictionary.Values.Cell(),
    cs.loadRef(),
  );
  const param8 = params.get(8);
  if (!param8) throw new Error("config param 8 global_version is missing");

  const versionSlice = param8.beginParse();
  const tag = versionSlice.loadUint(8);
  if (tag !== 0xc4) {
    throw new Error(`unexpected global_version tag 0x${tag.toString(16)}`);
  }

  return {
    configAddress,
    globalVersion: versionSlice.loadUint(32),
    capabilities: versionSlice.loadUintBig(64),
  };
}
