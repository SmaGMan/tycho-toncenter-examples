# Tycho Toncenter Examples

TypeScript examples for Tycho testnet:

- blockchain `signature_id` discovery;
- deposit tracking by masterchain block;
- native withdraw from EverWallet and multisig2 through direct JRPC or a signed BOC sent to toncenter;
- wallet-v5 r1 BOC formation with `@ton/core` and toncenter broadcast.

Default endpoints:

```text
Toncenter: https://toncenter-testnet.tychoprotocol.com
Tycho JRPC: https://rpc-testnet.tychoprotocol.com
```

## Setup

```bash
npm install
cp .env.example .env
```

Command-line arguments override environment variables.
For exact applicability, defaults, and interactions between options, see
[Detailed Argument Reference](#detailed-argument-reference).

## Signature Id

Both commands read the current network configuration and report whether
`CapSignatureWithId` is enabled. If it is enabled, use the network `globalId`
as `signature_id`.

```bash
npm run config:signature-id
npm run config:signature-id:standalone
```

- `config:signature-id` parses config param 8 with `@ton/core`.
- `config:signature-id:standalone` uses the `everscale-standalone-client` transport.
- `--rpc <url>` overrides `TYCHO_TESTNET_RPC`.
- `--config-boc <base64> --global-id <number>` parses an already fetched config BOC.

## Deposit Watcher

The watcher starts from `/toncenter/v3/masterchainInfo` and scans
`/toncenter/v3/transactionsByMasterchainBlock`. A transaction matches when its
non-bounced inbound message and account equal the deposit address and it has no
outbound messages. Matches are printed immediately as JSON lines.

One scan:

```bash
npm run deposit:watch -- \
  --address 0:<deposit-wallet-address> \
  --checkpoint deposit.checkpoint.json
```

Polling:

```bash
npm run deposit:watch -- \
  --address 0:<deposit-wallet-address> \
  --checkpoint deposit.checkpoint.json \
  --poll-ms 5000
```

Options:

- `--endpoint <url>` overrides `TYCHO_TESTNET_TONCENTER_ENDPOINT`.
- `--from <seqno>` starts from an explicit masterchain seqno.
- `--checkpoint <path>` stores `lastProcessedMasterSeqno`.
- `--require-not-aborted` also requires `aborted === false`.

## EverWallet Withdraw

Direct JRPC send:

```bash
npm run withdraw:standalone:direct -- \
  --wallet 0:<everwallet-address> \
  --secret-key <64-hex-secret-key> \
  --to 0:<recipient> \
  --amount 1.25
```

Build a signed BOC locally and broadcast it through
`/toncenter/v2/sendBocReturnHash`:

```bash
npm run withdraw:standalone:boc -- \
  --wallet 0:<everwallet-address> \
  --secret-key <64-hex-secret-key> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25
```

Options:

- `--rpc <url>` selects JRPC for the direct command.
- `--endpoint <url>` selects toncenter for the BOC command.
- `--bounce` enables bounce for the internal transfer.
- `--comment <text>` adds a text payload in the BOC command.
- `--signature-id <id>` sets the offline nekoton signature id.
- `--include-state-init` attaches sender EverWallet state init in the BOC command.
- `--public-key <hex>` overrides the key derived from `--secret-key`.
- `--nonce <uint32>` selects a non-standard sender layout in the BOC command.

State init is for an undeployed, pre-funded sender. The script validates that
the resulting address matches `--wallet`; omit `--nonce` for a standard
EverWallet.

Check account status:

```bash
curl -sG "https://toncenter-testnet.tychoprotocol.com/toncenter/v2/getWalletInformation" \
  --data-urlencode "address=<wallet-address>" | jq
```

## multisig2 Withdraw

Both withdraw commands call `submitTransaction`, which supports one-custodian
and M-of-N wallets.

Direct JRPC:

```bash
npm run withdraw:msig2:direct -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <custodian-secret-key-hex> \
  --to 0:<recipient> \
  --amount 1.25
```

The direct path checks `getCustodians` before sending and rejects a key that
does not belong to the wallet.

Signed BOC through toncenter:

```bash
npm run withdraw:msig2:boc -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <custodian-secret-key-hex> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25
```

The BOC path broadcasts through `/toncenter/v2/sendBocReturnHash`, then polls
wallet history and decodes the returned `transactionId` locally.

Options:

- `--rpc <url>` selects JRPC for direct commands.
- `--endpoint <url>` selects toncenter for BOC/history commands.
- `--public-key <hex>` overrides the key derived from `--secret-key`.
- `--timeout <seconds>` changes external-message expiration.
- `--signature-id <id>` sets the offline nekoton signature id; use `2000` on Tycho testnet.
- `--comment <text>` adds a text payload to the withdraw.
- `--bounce` enables bounce for the internal transfer.

### Pending transactions

Read the wallet state through JRPC:

```bash
npm run withdraw:msig2:pending:direct -- \
  --wallet 0:<msig2-wallet-address>
```

Or recover submissions from toncenter history without a secret key or BOC hash:

```bash
npm run withdraw:msig2:pending:toncenter -- \
  --wallet 0:<msig2-wallet-address> \
  --limit 50
```

Use the returned `id` or `transactionId` for confirmation. The history command
infers pending state within the selected history window.

If automatic recovery times out, inspect the same history manually:

```bash
curl -sG "https://toncenter-testnet.tychoprotocol.com/toncenter/v3/transactions" \
  --data-urlencode "account=0:<msig2-wallet-address>" \
  --data-urlencode "limit=50" | jq
```

The BOC command prints a hexadecimal `message.hash`, while toncenter returns
`in_msg.hash` in base64. Convert it when exact filtering is needed:

```bash
MESSAGE_HASH_HEX=<message.hash-from-withdraw-output>
MESSAGE_HASH_B64="$(printf '%s' "$MESSAGE_HASH_HEX" | xxd -r -p | base64 | tr -d '\n')"
```

### Confirm transaction

Direct JRPC:

```bash
npm run withdraw:msig2:confirm:direct -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <another-custodian-secret-key-hex> \
  --transaction-id <pending-transaction-id>
```

Signed BOC through toncenter:

```bash
npm run withdraw:msig2:confirm:boc -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <another-custodian-secret-key-hex> \
  --signature-id 2000 \
  --transaction-id <pending-transaction-id>
```

Both commands print one of these statuses:

- `executed`: the threshold was reached and the wallet emitted an internal transfer.
- `confirmed`: this confirmation was accepted, but more signatures are required.
- `not_observed`: the transaction was not found before message expiration; inspect pending state before retrying.

## `@ton/core` Wallet V5 Withdraw

This command builds a wallet-v5 r1 external message with `@ton/core` and sends
the BOC through toncenter. It is intentionally separate from EverWallet ABI
encoding.

```bash
npm run withdraw:ton-core:boc -- \
  --wallet 0:<wallet-v5-address> \
  --secret-key <128-hex-ed25519-secret-key> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25
```

Options:

- `--endpoint <url>` selects toncenter.
- `--seqno <number>` skips the `seqno` get-method lookup.
- `--workchain <number>` defaults to `0`.
- `--network-global-id <number>` defaults to `-239` and participates in wallet address derivation.
- `--signature-id <number>` prefixes the signed hash; use `2000` on Tycho testnet.
- `--subwallet-number <number>` defaults to `0`.
- `--send-mode <number>` defaults to `PAY_GAS_SEPARATELY`; `IGNORE_ERRORS` is added for external auth.
- `--include-state-init` attaches sender state init and defaults an omitted seqno to `0`.
- `--comment <text>` adds a text payload.

`network-global-id` and `signature-id` are separate values: the former changes
the wallet address, while the latter changes only the signed data. If
`--wallet` is supplied, the script verifies it against the secret key,
workchain, network global id, and subwallet number.

## Detailed Argument Reference

### Transport and endpoint arguments

#### `--rpc <url>`

Selects the Tycho JRPC endpoint used by direct standalone-client commands,
`config:signature-id*`, and `withdraw:msig2:pending:direct`. It overrides
`TYCHO_TESTNET_RPC`; if neither is set, the default is
`https://rpc-testnet.tychoprotocol.com`.

This option does not affect BOC commands: those use toncenter and `--endpoint`.

#### `--endpoint <url>`

Selects the toncenter instance used by the deposit watcher, all `*:boc`
commands, and `withdraw:msig2:pending:toncenter`. It overrides
`TYCHO_TESTNET_TONCENTER_ENDPOINT`; the default is
`https://toncenter-testnet.tychoprotocol.com`.

Use it for another network, a staging endpoint, or a local toncenter instance.
It does not affect direct JRPC commands.

### Signature configuration arguments

#### `--config-boc <base64>`

Applies to `config:signature-id`. Parses an already fetched
`getBlockchainConfig.config` BOC instead of making an RPC request. It must be
used with `--global-id` because the global id is returned next to the config
BOC by RPC and is not encoded in config param 8 itself.

#### `--global-id <number>`

Supplies the network global id when `--config-boc` is used. If config param 8
contains `CapSignatureWithId`, this value is reported as the required
`signature_id`.

#### `--signature-id <number>`

Used when a BOC is signed locally by nekoton or `@ton/core`. On a network with
`CapSignatureWithId`, it is included in the Ed25519 signature input. Tycho
testnet currently uses `2000`; verify it with one of the `config:signature-id`
commands rather than assuming the value for another network.

Direct standalone-client commands obtain signature configuration from JRPC and
do not need this option. For wallet-v5, `signature-id` affects only the
signature; it does not participate in wallet address derivation.

### Deposit watcher arguments

#### `--address <address>`

Required deposit address. Both the transaction account and inbound-message
destination must match it after raw-address normalization.

#### `--from <masterchain-seqno>`

Starts scanning from an explicit masterchain seqno. If omitted, the watcher
continues after the checkpoint; without either value, it starts at the current
masterchain block.

#### `--checkpoint <path>`

Reads and writes a JSON file containing `lastProcessedMasterSeqno`. The file is
updated after each processed masterchain block, so a later run can resume from
the next block. Omit this option for a stateless scan.

#### `--poll-ms <milliseconds>`

Enables continuous polling and waits this many milliseconds between scans. It
must be a positive integer. Without it, the command performs one scan and
exits.

#### `--require-not-aborted`

Adds `transaction.aborted === false` to the deposit filter. Without the flag,
the watcher uses only the inbound-message, account, bounced, and outbound-message
conditions.

### Shared withdraw arguments

#### `--wallet <address>`

Sender wallet address. EverWallet and multisig2 commands can read it from
`EVERWALLET_ADDRESS` and `MSIG2_WALLET_ADDRESS` respectively. Wallet-v5 can use
`TON_WALLET_ADDRESS`; if it is omitted, the address is computed from the key and
wallet id parameters.

When wallet-v5 or EverWallet BOC state-init parameters are present, the command
recomputes the expected sender address and rejects a mismatch before broadcast.

#### `--secret-key <key>`

Signing key. EverWallet and multisig2 commands accept a hexadecimal secret key
and can read it from `EVERWALLET_SECRET_KEY` or `MSIG2_SECRET_KEY`.
Wallet-v5 requires a 64-byte Ed25519 secret key (`private || public`) encoded as
128 hexadecimal characters or base64 and can read it from
`TON_WALLET_SECRET_KEY`.

The secret key is used locally and is not sent as an API parameter.

#### `--public-key <64-hex>`

EverWallet and multisig2 signer public key, exactly 32 bytes in hexadecimal.
Normally omit it: the command derives it from `--secret-key`. Supply it only
when an explicit public key is required for state-init or signer selection.

For direct multisig2 commands, the selected public key must appear in
`getCustodians`; otherwise the command fails before sending.

#### `--to <address>`

Required recipient of the internal native-token transfer.

#### `--amount <tokens>`

Required human-readable native amount, for example `1`, `1.25`, or
`0.000000001`. It is converted to nano units with 9 decimal places. Negative
values and fractions longer than 9 digits are rejected.

#### `--bounce`

Sets `bounce: true` on the internal transfer. Without it, the commands use
`bounce: false`, which is normally suitable for simple user or exchange
withdrawals.

#### `--comment <text>`

Encodes a standard text-comment body (`uint32 0` followed by the UTF-8 text).
It is available in EverWallet BOC, multisig2 withdraw, and wallet-v5 BOC
commands. Omit it for an empty transfer payload.

### EverWallet-specific arguments

#### `--include-state-init`

Applies to `withdraw:standalone:boc` and attaches EverWallet state init to the
external message. Use it only when the sender wallet is not deployed yet, its
future address is already funded, and the first outgoing transfer should deploy
it. It applies to the sender, not the recipient.

The command verifies that the state init derived from the public key and nonce
matches `--wallet`. Omit the option for an active wallet.

#### `--nonce <uint32>`

Applies to `withdraw:standalone:boc` and selects a non-standard EverWallet data
layout containing a nonce. It must be the same nonce that was used when deriving
the sender address. For a standard EverWallet, omit it.

When supplied without `--include-state-init`, it is still used for sender
address validation but no state init is attached to the BOC.

#### `--timeout <seconds>`

Applies to `withdraw:standalone:boc` and changes the locally built external
message expiration interval. The default is 60 seconds. The direct EverWallet
command uses standalone-client message handling and does not consume this CLI
value.

### multisig2-specific arguments

#### `--timeout <seconds>`

Changes multisig2 external-message expiration. Direct JRPC commands default to
30 seconds; locally built BOCs default to 60 seconds. The toncenter BOC path
polls wallet history until expiration plus a short grace period.

#### `--transaction-id <uint64>`

Required by `withdraw:msig2:confirm:*`. Accepts decimal or `0x`-prefixed
hexadecimal input and normalizes it to an unsigned 64-bit decimal string. Obtain
it from `withdraw:msig2:pending:direct`,
`withdraw:msig2:pending:toncenter`, or the result of the initial submission.

#### `--limit <count>`

Applies to `withdraw:msig2:pending:toncenter` and controls how many recent
wallet transactions are inspected. The default is `50`. Increase it if the
submission is older than the current history window.

The toncenter command infers pending submissions from history; the direct
pending command reads the wallet's current `getTransactions` state.

### Wallet-v5-specific arguments

#### `--seqno <number>`

Overrides the sender wallet sequence number and skips the toncenter `seqno`
get-method call. The value must match current on-chain state when the message is
delivered. If `--include-state-init` is set and seqno is omitted, the command
uses `0`; otherwise it reads seqno from toncenter.

The automatic lookup calls `POST /toncenter/v3/runGetMethod` with JSON body
`{ address, method: "seqno", stack: [] }`.

#### `--workchain <number>`

Workchain used to derive the wallet-v5 address. The default is `0`. Use `-1`
only for an intentionally masterchain-hosted sender. A different workchain
produces a different wallet address.

#### `--network-global-id <number>`

Part of the wallet-v5 r1 wallet id and therefore part of address derivation. The
default is `-239`. It must match the value used when the wallet was originally
created; a different value changes the computed address.

This is separate from `--signature-id`: even if a network happens to use the
same numeric value for both, they have different roles.

#### `--subwallet-number <number>`

Selects a wallet-v5 subwallet for the same key, workchain, and network global
id. The default is `0`. Changing it changes the derived wallet address.

#### `--send-mode <number>`

Base send mode for wallet-v5 actions. It defaults to
`PAY_GAS_SEPARATELY` (`1`). The implementation also adds `IGNORE_ERRORS` (`2`)
for wallet-v5 external authentication. Override it only when a different send
mode is intentionally required.

#### `--include-state-init`

Attaches wallet-v5 r1 sender state init. Use it for an undeployed, pre-funded
wallet. When seqno is not supplied, this mode uses `seqno = 0` instead of
calling the get-method.

#### `--timeout <unix-timestamp>`

For an already deployed wallet (`seqno != 0`), sets the absolute Unix
`valid_until` timestamp stored in the signed request. If omitted, the command
uses the current time plus 60 seconds. For `seqno = 0`, wallet-v5 uses
`0xffffffff` and ignores this value.

## Environment Variables

```dotenv
TYCHO_TESTNET_TONCENTER_ENDPOINT=https://toncenter-testnet.tychoprotocol.com
TYCHO_TESTNET_RPC=https://rpc-testnet.tychoprotocol.com
EVERWALLET_ADDRESS=0:<wallet-address-hash>
EVERWALLET_SECRET_KEY=<64-hex-secret-key>
MSIG2_WALLET_ADDRESS=0:<msig2-wallet-address-hash>
MSIG2_SECRET_KEY=<64-hex-secret-key>
TON_WALLET_ADDRESS=0:<wallet-address-hash>
TON_WALLET_SECRET_KEY=<128-hex-ed25519-secret-key>
```
