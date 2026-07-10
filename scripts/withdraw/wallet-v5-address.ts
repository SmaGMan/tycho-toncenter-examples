import { keyPairFromSeed } from "@ton/crypto";

import { Args, hexArg } from "../../src/cli/args";
import { runMain } from "../../src/cli/errors";
import { printJson } from "../../src/cli/format";
import { computeTonCoreWalletV5Address } from "../../src/withdraw/ton-core-wallet-v5";

runMain(async () => {
  const args = new Args();
  const publicKey = readPublicKey(args);
  const workchain = intInRange(args, "workchain", 0, -128, 127);
  const networkGlobalId = intInRange(args, "network-global-id", -239, -0x80000000, 0x7fffffff);
  const subwalletNumber = intInRange(args, "subwallet-number", 0, 0, 0x7fff);

  const wallet = computeTonCoreWalletV5Address({
    publicKey,
    workchain,
    networkGlobalId,
    subwalletNumber,
  });

  printJson({
    builder: "@ton/core wallet v5 r1",
    wallet,
    publicKey: publicKey.toString("hex"),
    workchain,
    networkGlobalId,
    subwalletNumber,
  });
});

function readPublicKey(args: Args): Buffer {
  const publicKey = args.get("public-key");
  const secretKey = args.get("secret-key");
  if ((publicKey == null) === (secretKey == null)) {
    throw new Error("pass exactly one of --public-key or --secret-key");
  }

  if (publicKey != null) {
    return Buffer.from(hexArg("public-key", publicKey, 32), "hex");
  }

  const encodedSecretKey = Buffer.from(hexArg("secret-key", secretKey!, 64), "hex");
  const keyPair = keyPairFromSeed(encodedSecretKey.subarray(0, 32));
  if (!keyPair.publicKey.equals(encodedSecretKey.subarray(32))) {
    throw new Error("--secret-key public half does not match its private half");
  }
  return keyPair.publicKey;
}

function intInRange(args: Args, name: string, defaultValue: number, min: number, max: number): number {
  const value = args.int(name) ?? defaultValue;
  if (value < min || value > max) {
    throw new Error(`--${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}
