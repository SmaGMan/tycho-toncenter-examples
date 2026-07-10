import {
  Address,
  Cell,
  SendMode,
  beginCell,
  contractAddress,
  external,
  internal,
  storeMessage,
  storeOutList,
  type Builder,
  type MessageRelaxed,
  type OutAction,
  type StateInit,
} from "@ton/core";
import { keyPairFromSecretKey, sign } from "@ton/crypto";

import { ToncenterClient, readSeqnoFromRunGetMethod } from "../toncenter/client";

const AUTH_SIGNED_EXTERNAL = 0x7369676e;

export type TonCoreWalletV5WithdrawParams = {
  wallet?: string;
  secretKey: Buffer;
  recipient: string;
  amountNano: string;
  bounce: boolean;
  seqno?: number;
  workchain?: number;
  networkGlobalId: number;
  subwalletNumber?: number;
  signatureId?: number;
  timeout?: number;
  sendMode?: number;
  comment?: string;
  includeStateInit?: boolean;
};

export type BuiltTonCoreWalletV5Boc = {
  boc: string;
  wallet: string;
  bodyHash: string;
  networkGlobalId: number;
  subwalletNumber: number;
};

export type TonCoreWalletV5AddressParams = {
  publicKey: Buffer;
  workchain?: number;
  networkGlobalId?: number;
  subwalletNumber?: number;
};

export async function buildTonCoreWalletV5Boc(
  client: ToncenterClient,
  params: TonCoreWalletV5WithdrawParams,
): Promise<BuiltTonCoreWalletV5Boc> {
  const keyPair = keyPairFromSecretKey(params.secretKey);
  const derivedWallet = deriveTonCoreWalletV5Address({
    publicKey: keyPair.publicKey,
    workchain: params.workchain,
    networkGlobalId: params.networkGlobalId,
    subwalletNumber: params.subwalletNumber,
  });
  const {
    workchain,
    networkGlobalId,
    subwalletNumber,
    walletId,
    stateInit: walletInit,
    address: computedWallet,
  } = derivedWallet;
  const wallet = params.wallet ? Address.parse(params.wallet) : computedWallet;

  if (params.wallet && wallet.toRawString() !== computedWallet.toRawString()) {
    throw new Error(
      `wallet address does not match secret key/workchain/wallet id: expected ${computedWallet.toRawString()}`,
    );
  }

  const seqno = params.seqno ?? (params.includeStateInit ? 0 : await readWalletSeqno(client, wallet));
  const body = createWalletV5TransferBody({
    seqno,
    secretKey: params.secretKey,
    walletId,
    signatureId: params.signatureId,
    timeout: params.timeout,
    sendMode: params.sendMode ?? SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: params.recipient,
        value: BigInt(params.amountNano),
        bounce: params.bounce,
        body: params.comment,
      }),
    ],
  });

  const externalMessage = external({
    to: wallet,
    init: params.includeStateInit ? walletInit : undefined,
    body,
  });
  const boc = beginCell().store(storeMessage(externalMessage)).endCell().toBoc().toString("base64");

  return {
    boc,
    wallet: wallet.toRawString(),
    bodyHash: body.hash().toString("hex"),
    networkGlobalId,
    subwalletNumber,
  };
}

export async function sendTonCoreWalletV5BocViaToncenter(
  client: ToncenterClient,
  params: TonCoreWalletV5WithdrawParams,
) {
  const message = await buildTonCoreWalletV5Boc(client, params);
  const result = await client.sendBocReturnHash(message.boc);
  return { message, result };
}

export function computeTonCoreWalletV5Address(params: TonCoreWalletV5AddressParams): string {
  return deriveTonCoreWalletV5Address(params).address.toRawString();
}

async function readWalletSeqno(client: ToncenterClient, wallet: Address): Promise<number> {
  const result = await client.runGetMethod(wallet.toRawString(), "seqno");
  return readSeqnoFromRunGetMethod(result);
}

type WalletV5Id = {
  networkGlobalId: number;
  workchain: number;
  subwalletNumber: number;
};

function deriveTonCoreWalletV5Address(params: TonCoreWalletV5AddressParams): {
  address: Address;
  stateInit: StateInit;
  walletId: WalletV5Id;
  workchain: number;
  networkGlobalId: number;
  subwalletNumber: number;
} {
  if (params.publicKey.length !== 32) {
    throw new Error(`wallet-v5 public key must be 32 bytes, got ${params.publicKey.length}`);
  }

  const workchain = params.workchain ?? 0;
  const networkGlobalId = params.networkGlobalId ?? -239;
  const subwalletNumber = params.subwalletNumber ?? 0;
  assertIntegerInRange("wallet-v5 workchain", workchain, -128, 127);
  assertIntegerInRange("wallet-v5 network global id", networkGlobalId, -0x80000000, 0x7fffffff);
  assertIntegerInRange("wallet-v5 subwallet number", subwalletNumber, 0, 0x7fff);

  const walletId = { networkGlobalId, workchain, subwalletNumber };
  const stateInit = makeWalletV5StateInit(params.publicKey, walletId);
  return {
    address: contractAddress(workchain, stateInit),
    stateInit,
    walletId,
    workchain,
    networkGlobalId,
    subwalletNumber,
  };
}

function assertIntegerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
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

function createWalletV5TransferBody(args: {
  seqno: number;
  secretKey: Buffer;
  walletId: WalletV5Id;
  signatureId?: number;
  timeout?: number;
  sendMode: number;
  messages: MessageRelaxed[];
}): Cell {
  if (args.messages.length > 255) {
    throw new Error("Wallet v5 supports at most 255 actions in one transfer");
  }

  const actions: OutAction[] = args.messages.map(message => ({
    type: "sendMsg",
    mode: args.sendMode | SendMode.IGNORE_ERRORS,
    outMsg: message,
  }));

  const signingMessage = beginCell()
    .storeUint(AUTH_SIGNED_EXTERNAL, 32)
    .store(storeWalletIdV5R1(args.walletId));

  if (args.seqno === 0) {
    signingMessage.storeUint(0xffffffff, 32);
  } else {
    signingMessage.storeUint(args.timeout ?? Math.floor(Date.now() / 1000) + 60, 32);
  }

  signingMessage
    .storeUint(args.seqno, 32)
    .store(storeOutListExtendedV5R1(actions));

  const signature = sign(addSignatureId(signingMessage.endCell().hash(), args.signatureId), args.secretKey);
  return beginCell().storeBuilder(signingMessage).storeBuffer(signature).endCell();
}

function addSignatureId(data: Buffer, signatureId: number | undefined): Buffer {
  if (signatureId == null) return data;
  const signatureIdBytes = Buffer.alloc(4);
  signatureIdBytes.writeInt32BE(signatureId);
  return Buffer.concat([signatureIdBytes, data]);
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

function storeOutListExtendedV5R1(actions: OutAction[]): (builder: Builder) => void {
  return builder => {
    const outListPacked = actions.length
      ? beginCell().store(storeOutList(actions.slice().reverse())).endCell()
      : undefined;
    builder.storeMaybeRef(outListPacked);
    builder.storeUint(0, 1);
  };
}

const WALLET_V5R1_CODE = Cell.fromBoc(Buffer.from(
  "b5ee9c7241021401000281000114ff00f4a413f4bcf2c80b01020120020d020148030402dcd020d749c120915b8f6320d70b1f2082106578746ebd21821073696e74bdb0925f03e082106578746eba8eb48020d72101d074d721fa4030fa44f828fa443058bd915be0ed44d0810141d721f4058307f40e6fa1319130e18040d721707fdb3ce03120d749810280b99130e070e2100f020120050c020120060902016e07080019adce76a2684020eb90eb85ffc00019af1df6a2684010eb90eb858fc00201480a0b0017b325fb51341c75c875c2c7e00011b262fb513435c280200019be5f0f6a2684080a0eb90fa02c0102f20e011e20d70b1f82107369676ebaf2e08a7f0f01e68ef0eda2edfb218308d722028308d723208020d721d31fd31fd31fed44d0d200d31f20d31fd3ffd70a000af90140ccf9109a28945f0adb31e1f2c087df02b35007b0f2d0845125baf2e0855036baf2e086f823bbf2d0882292f800de01a47fc8ca00cb1f01cf16c9ed542092f80fde70db3cd81003f6eda2edfb02f404216e926c218e4c0221d73930709421c700b38e2d01d72820761e436c20d749c008f2e09320d74ac002f2e09320d71d06c712c2005230b0f2d089d74cd7393001a4e86c128407bbf2e093d74ac000f2e093ed55e2d20001c000915be0ebd72c08142091709601d72c081c12e25210b1e30f20d74a111213009601fa4001fa44f828fa443058baf2e091ed44d0810141d718f405049d7fc8ca0040048307f453f2e08b8e14038307f45bf2e08c22d70a00216e01b3b0f2d090e2c85003cf1612f400c9ed54007230d72c08248e2d21f2e092d200ed44d0d2005113baf2d08f54503091319c01810140d721d70a00f2e08ee2c8ca0058cf16c9ed5493f2c08de20010935bdb31e1d74cd0b4d6c35e",
  "hex",
))[0];
