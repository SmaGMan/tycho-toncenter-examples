import { ProviderRpcClient } from "everscale-inpage-provider";
import {
  EverscaleStandaloneClient,
  SimpleKeystore,
  type AccountsStorage,
  type MessageProperties,
} from "everscale-standalone-client/nodejs";

type StandaloneSigner = {
  publicKey: string;
  secretKey: string;
};

export async function createStandaloneProvider(
  rpcEndpoint: string,
  options: {
    signer?: StandaloneSigner;
    accountsStorage?: AccountsStorage;
    message?: MessageProperties;
  } = {},
): Promise<ProviderRpcClient> {
  const keystore = options.signer
    ? new SimpleKeystore({
      [options.signer.publicKey]: options.signer,
    })
    : undefined;
  const standalone = await EverscaleStandaloneClient.create({
    connection: {
      id: 1,
      type: "jrpc",
      data: { endpoint: rpcEndpoint },
    },
    keystore,
    accountsStorage: options.accountsStorage,
    message: options.message,
  });
  const provider = new ProviderRpcClient({
    forceUseFallback: true,
    fallback: async () => standalone,
  });
  await provider.ensureInitialized();
  return provider;
}
