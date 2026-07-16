import { beginCell, Cell, contractAddress, type Builder, type StateInit } from "@ton/core";
import { deriveBip39Phrase, getPublicKey, makeBip39Path } from "everscale-crypto";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);

const getArg = (name: string) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
};

const hasFlag = (name: string) => args.includes(`--${name}`);

const parseUint32 = (name: string, value: string | undefined) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffffffff) {
    throw new Error(`--${name} must be a uint32`);
  }
  return parsed;
};

const parseIntRange = (name: string, value: string | undefined, min: number, max: number) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${name} must be an integer from ${min} to ${max}`);
  }
  return parsed;
};

const strip0x = (value: string) => value.replace(/^0x/i, "");

function readInputFile(name: string, path: string) {
  let value: string;
  try {
    value = readFileSync(path, "utf8").trim();
  } catch (error) {
    const reason = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`cannot read --${name} ${path}${reason}`);
  }

  if (!value) throw new Error(`--${name} file is empty: ${path}`);
  return value;
}

function publicKeyFromPrivateInput(secret: string) {
  const value = strip0x(secret);
  if (!/^[0-9a-fA-F]{64}([0-9a-fA-F]{64})?$/.test(value)) {
    throw new Error("private key must be 64 hex characters, or 128 hex TON ed25519 secret key");
  }

  const privateKey = value.slice(0, 64);
  const publicKey = getPublicKey(privateKey);
  const suppliedPublicKey = value.length === 128 ? value.slice(64) : undefined;
  if (suppliedPublicKey && suppliedPublicKey.toLowerCase() !== publicKey.toLowerCase()) {
    throw new Error("128-hex TON ed25519 secret key public half does not match its private half");
  }

  return { privateKey, publicKey };
}

const main = async () => {
  const seedArg = getArg("seed");
  const seedFile = getArg("seed-file");
  const secretArg = getArg("secret-key");
  const secretFile = getArg("secret-file");
  const suppliedPublic = getArg("public-key");
  const printSecretKey = hasFlag("print-secret-key");
  const sources = [seedArg, seedFile, secretArg, secretFile, suppliedPublic].filter(value => value !== undefined);
  if (sources.length !== 1) {
    throw new Error("pass exactly one of --seed, --seed-file, --secret-key, --secret-file, or --public-key");
  }

  const seed = seedFile ? readInputFile("seed-file", seedFile) : seedArg;
  const secret = secretFile ? readInputFile("secret-file", secretFile) : secretArg;

  const accountArg = getArg("account");
  if (accountArg && !seed) throw new Error("--account is only used with --seed or --seed-file");
  const account = parseUint32("account", accountArg) ?? 0;
  const nonce = parseUint32("nonce", getArg("nonce"));
  const walletV5 = hasFlag("wallet-v5");
  if (walletV5 && nonce !== undefined) throw new Error("--nonce is only used for EverWallet addresses");

  const walletV5Workchain = parseIntRange("workchain", getArg("workchain"), -128, 127) ?? 0;
  const networkGlobalId = parseIntRange("network-global-id", getArg("network-global-id"), -0x80000000, 0x7fffffff) ?? -239;
  const subwalletNumber = parseIntRange("subwallet-number", getArg("subwallet-number"), 0, 0x7fff) ?? 0;

  let publicKey: string;
  let privateKey: string | undefined;
  let printPublic = false;

  if (seed) {
    const kp = deriveBip39Phrase(seed, makeBip39Path(account));
    privateKey = strip0x(kp.secretKey);
    publicKey = kp.publicKey;
    printPublic = true;
  } else if (secret) {
    const parsed = publicKeyFromPrivateInput(secret);
    privateKey = parsed.privateKey;
    publicKey = parsed.publicKey;
    printPublic = true;
  } else {
    publicKey = strip0x(suppliedPublic!);
    if (printSecretKey) console.warn("--print-secret-key is ignored with --public-key");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) throw new Error("public key must be 64 hex characters");

  // 1. Print derived public key before addresses.
  if (printPublic) console.log(`public: ${publicKey}`);
  if (printSecretKey && privateKey) {
    console.log(`private: ${privateKey}`);
    console.log(`ton ed25519 secret: ${privateKey}${publicKey}`);
  }

  if (walletV5) {
    const wallet = computeWalletV5Address({
      publicKey: Buffer.from(publicKey, "hex"),
      workchain: walletV5Workchain,
      networkGlobalId,
      subwalletNumber,
    });
    console.log(
      `wallet-v5 r1 workchain ${walletV5Workchain} network-global-id ${networkGlobalId} subwallet ${subwalletNumber}: ${wallet}`,
    );
    return;
  }

  // 2. Compute EverWallet addresses for Tycho workchains.
  console.log(`workchain -1: ${computeEverWalletAddress(publicKey, -1, nonce)}`);
  console.log(`workchain 0: ${computeEverWalletAddress(publicKey, 0, nonce)}`);
};

function computeEverWalletAddress(publicKey: string, workchain: number, nonce: number | undefined) {
  const data = beginCell()
    .storeUint(BigInt(`0x${publicKey}`), 256)
    .storeUint(0, 64);

  if (nonce !== undefined) data.storeUint(nonce, 32);

  return contractAddress(workchain, {
    code: EVER_WALLET_CODE,
    data: data.endCell(),
  }).toRawString();
}

type WalletV5Id = {
  networkGlobalId: number;
  workchain: number;
  subwalletNumber: number;
};

function computeWalletV5Address(args: WalletV5Id & { publicKey: Buffer }) {
  return contractAddress(args.workchain, makeWalletV5StateInit(args.publicKey, args)).toRawString();
}

function makeWalletV5StateInit(publicKey: Buffer, walletId: WalletV5Id): StateInit {
  const data = beginCell()
    .storeUint(1, 1)
    .storeUint(0, 32)
    .store(storeWalletIdV5R1(walletId))
    .storeBuffer(publicKey, 32)
    .storeBit(0)
    .endCell();

  return { code: WALLET_V5R1_CODE, data };
}

function storeWalletIdV5R1(walletId: WalletV5Id): (builder: Builder) => Builder {
  return builder => {
    const context = beginCell()
      .storeUint(1, 1)
      .storeInt(walletId.workchain, 8)
      .storeUint(0, 8)
      .storeUint(walletId.subwalletNumber, 15)
      .endCell()
      .beginParse()
      .loadInt(32);

    return builder.storeInt(BigInt(walletId.networkGlobalId) ^ BigInt(context), 32);
  };
}

const WALLET_V5R1_CODE = Cell.fromBoc(Buffer.from(
  "b5ee9c7241021401000281000114ff00f4a413f4bcf2c80b01020120020d020148030402dcd020d749c120915b8f6320d70b1f2082106578746ebd21821073696e74bdb0925f03e082106578746eba8eb48020d72101d074d721fa4030fa44f828fa443058bd915be0ed44d0810141d721f4058307f40e6fa1319130e18040d721707fdb3ce03120d749810280b99130e070e2100f020120050c020120060902016e07080019adce76a2684020eb90eb85ffc00019af1df6a2684010eb90eb858fc00201480a0b0017b325fb51341c75c875c2c7e00011b262fb513435c280200019be5f0f6a2684080a0eb90fa02c0102f20e011e20d70b1f82107369676ebaf2e08a7f0f01e68ef0eda2edfb218308d722028308d723208020d721d31fd31fd31fed44d0d200d31f20d31fd3ffd70a000af90140ccf9109a28945f0adb31e1f2c087df02b35007b0f2d0845125baf2e0855036baf2e086f823bbf2d0882292f800de01a47fc8ca00cb1f01cf16c9ed542092f80fde70db3cd81003f6eda2edfb02f404216e926c218e4c0221d73930709421c700b38e2d01d72820761e436c20d749c008f2e09320d74ac002f2e09320d71d06c712c2005230b0f2d089d74cd7393001a4e86c128407bbf2e093d74ac000f2e093ed55e2d20001c000915be0ebd72c08142091709601d72c081c12e25210b1e30f20d74a111213009601fa4001fa44f828fa443058baf2e091ed44d0810141d718f405049d7fc8ca0040048307f453f2e08b8e14038307f45bf2e08c22d70a00216e01b3b0f2d090e2c85003cf1612f400c9ed54007230d72c08248e2d21f2e092d200ed44d0d2005113baf2d08f54503091319c01810140d721d70a00f2e08ee2c8ca0058cf16c9ed5493f2c08de20010935bdb31e1d74cd0b4d6c35e",
  "hex",
))[0];

const EVER_WALLET_CODE = Cell.fromBoc(Buffer.from(
  "te6cckEBBgEA/AABFP8A9KQT9LzyyAsBAgEgAgMABNIwAubycdcBAcAA8nqDCNcY7UTQgwfXAdcLP8j4KM8WI88WyfkAA3HXAQHDAJqDB9cBURO68uBk3oBA1wGAINcBgCDXAVQWdfkQ8qj4I7vyeWa++COBBwiggQPoqFIgvLHydAIgghBM7mRsuuMPAcjL/8s/ye1UBAUAmDAC10zQ+kCDBtcBcdcBeNcB10z4AHCAEASqAhSxyMsFUAXPFlAD+gLLaSLQIc8xIddJoIQJuZgzcAHLAFjPFpcwcQHLABLM4skB+wAAPoIQFp4+EbqOEfgAApMg10qXeNcB1AL7AOjRkzLyPOI+zYS/",
  "base64",
))[0];

main().catch(error => {
  console.error(error);
  process.exit(1);
});
