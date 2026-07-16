import {
  buildMultisigBoc,
  makeMultisigConfirmCall,
  makeMultisigWithdrawCall,
  type BuiltMultisigWalletBoc,
  type MultisigCall,
  type MultisigConfirmParams,
  type MultisigMethod,
  type MultisigSignerParams,
  type MultisigWalletWithdrawParams,
} from "./multisig-standalone-offline";

export type SafeMultisigSignerParams = MultisigSignerParams;
export type SafeMultisigWalletWithdrawParams = MultisigWalletWithdrawParams;
export type SafeMultisigConfirmParams = MultisigConfirmParams;
export type SafeMultisigMethod = MultisigMethod;
export type SafeMultisigCall = MultisigCall;
export type BuiltSafeMultisigWalletBoc = BuiltMultisigWalletBoc;

/**
 * Builds and signs SafeMultisig external messages with local crypto and the
 * bundled Nekoton WASM only. No transport or account-state request is created.
 */
export function buildSafeMultisigWalletBoc(
  params: SafeMultisigWalletWithdrawParams,
): BuiltSafeMultisigWalletBoc {
  return buildMultisigBoc(SAFEMULTISIG_SPEC, params, makeSafeMultisigWithdrawCall(params));
}

export function buildSafeMultisigConfirmBoc(
  params: SafeMultisigConfirmParams,
): BuiltSafeMultisigWalletBoc {
  return buildMultisigBoc(SAFEMULTISIG_SPEC, params, makeSafeMultisigConfirmCall(params));
}

export function makeSafeMultisigWithdrawCall(
  params: SafeMultisigWalletWithdrawParams,
): SafeMultisigCall {
  return makeMultisigWithdrawCall(SAFEMULTISIG_SPEC, params);
}

export function makeSafeMultisigConfirmCall(
  params: SafeMultisigConfirmParams,
): SafeMultisigCall {
  return makeMultisigConfirmCall(params);
}

/** ABI of the legacy SafeMultisigWallet contract. */
export const SAFEMULTISIG_ABI = `{
  "ABI version": 2,
  "header": ["pubkey", "time", "expire"],
  "functions": [{
    "name": "constructor",
    "inputs": [
      {"name":"owners","type":"uint256[]"},
      {"name":"reqConfirms","type":"uint8"}
    ],
    "outputs": []
  }, {
    "name": "submitTransaction",
    "inputs": [
      {"name":"dest","type":"address"},
      {"name":"value","type":"uint128"},
      {"name":"bounce","type":"bool"},
      {"name":"allBalance","type":"bool"},
      {"name":"payload","type":"cell"}
    ],
    "outputs": [
      {"name":"transId","type":"uint64"}
    ]
  }, {
    "name": "confirmTransaction",
    "inputs": [
      {"name":"transactionId","type":"uint64"}
    ],
    "outputs": []
  }, {
    "name": "getCustodians",
    "inputs": [],
    "outputs": [{
      "name":"custodians",
      "type":"tuple[]",
      "components":[
        {"name":"index","type":"uint8"},
        {"name":"pubkey","type":"uint256"}
      ]
    }]
  }, {
    "name": "getTransactions",
    "inputs": [],
    "outputs": [{
      "name":"transactions",
      "type":"tuple[]",
      "components":[
        {"name":"id","type":"uint64"},
        {"name":"confirmationsMask","type":"uint32"},
        {"name":"signsRequired","type":"uint8"},
        {"name":"signsReceived","type":"uint8"},
        {"name":"creator","type":"uint256"},
        {"name":"index","type":"uint8"},
        {"name":"dest","type":"address"},
        {"name":"value","type":"uint128"},
        {"name":"sendFlags","type":"uint16"},
        {"name":"payload","type":"cell"},
        {"name":"bounce","type":"bool"}
      ]
    }]
  }],
  "events": []
}`;

export const SAFEMULTISIG_SPEC = {
  name: "SafeMultisig",
  abi: SAFEMULTISIG_ABI,
  submitStateInit: false,
  minimumAmount: {
    nano: 1_000_000n,
    display: "0.001",
  },
} as const;
