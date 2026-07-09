import { EverscaleStandaloneClient } from "everscale-standalone-client/nodejs";
import { CAP_SIGNATURE_WITH_ID_MASK } from "./signature-id";

type NetworkDescription = {
  globalId: number;
  capabilities: string;
  signatureId?: number;
};

type StandaloneTransport = {
  getNetworkDescription(): Promise<NetworkDescription>;
  getSignatureId(): Promise<number | undefined>;
};

type StandaloneWithContext = {
  _context?: {
    connectionController?: {
      use<T>(
        callback: (connection: { data: { transport: StandaloneTransport } }) => Promise<T>,
      ): Promise<T>;
    };
  };
};

export type StandaloneSignatureIdInfo = {
  globalId: number;
  capabilities: string;
  capabilitiesHex: string;
  capSignatureWithId: boolean;
  networkDescriptionSignatureId: number | null;
  signatureIdRequired: boolean;
  signatureId: number | null;
};

export async function readStandaloneSignatureIdInfo(rpcEndpoint: string): Promise<StandaloneSignatureIdInfo> {
  const standalone = await EverscaleStandaloneClient.create({
    connection: {
      id: 1,
      type: "jrpc",
      data: { endpoint: rpcEndpoint },
    },
  });

  // The installed standalone client computes signature id on its transport, but
  // does not expose a public helper for reading it directly.
  const connectionController = (standalone as unknown as StandaloneWithContext)
    ._context
    ?.connectionController;
  if (!connectionController) {
    throw new Error("everscale-standalone-client connection controller is not initialized");
  }

  const { networkDescription, signatureId } = await connectionController.use(async ({ data: { transport } }) => {
    const [networkDescription, signatureId] = await Promise.all([
      transport.getNetworkDescription(),
      transport.getSignatureId(),
    ]);
    return { networkDescription, signatureId };
  });

  const capabilities = parseCapabilities(networkDescription.capabilities);
  const capSignatureWithId = (capabilities & CAP_SIGNATURE_WITH_ID_MASK) !== 0n;
  const resolvedSignatureId = signatureId ?? networkDescription.signatureId ?? null;

  return {
    globalId: networkDescription.globalId,
    capabilities: capabilities.toString(),
    capabilitiesHex: `0x${capabilities.toString(16)}`,
    capSignatureWithId,
    networkDescriptionSignatureId: networkDescription.signatureId ?? null,
    signatureIdRequired: resolvedSignatureId != null,
    signatureId: resolvedSignatureId,
  };
}

function parseCapabilities(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("network capabilities value is empty");
  return BigInt(trimmed);
}
