# Tycho Toncenter Examples

TypeScript examples for Tycho testnet:

- blockchain `signature_id` discovery;
- deposit tracking by masterchain block;
- native withdraw from EverWallet and multisig2 through direct JRPC, offline BOC preparation, or a signed BOC sent to toncenter;
- wallet-v5 r1 address derivation, offline BOC preparation, and Toncenter submission with `@ton/core`.

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

## Compute Wallet Addresses

This utility computes addresses locally. It does not sign, broadcast, or call
an RPC endpoint.

Compute EverWallet addresses in workchains `-1` and `0` from a public key:

```bash
npm run utils:wallet-address -- --public-key <public-key>
```

From a private key:

```bash
npm run utils:wallet-address -- --secret-key <secret-key>
```

Or read the private key from a UTF-8 text file:

```bash
npm run utils:wallet-address -- --secret-file ./wallet.secret
```

`--secret-key` accepts either a 64-hex private seed or a 128-hex TON Ed25519
secret key in `private + public` format. `--secret-file` accepts the same two
formats. Leading and trailing whitespace in the file is ignored.

From a seed phrase:

```bash
npm run utils:wallet-address -- --seed "<seed phrase>" --account 0
```

Or read the seed phrase from a UTF-8 text file:

```bash
npm run utils:wallet-address -- --seed-file ./wallet.seed --account 0
```

`--account` selects the BIP39 account index for `--seed` or `--seed-file`.
Default: `0`. Leading and trailing whitespace in the file is ignored.

Pass exactly one key source: `--seed`, `--seed-file`, `--secret-key`,
`--secret-file`, or `--public-key`.

Add `--nonce <uint32>` only when you need another EverWallet address variant
for the same public key. Omit it for the standard Tycho wallet address shape.

Compute a TON wallet-v5 r1 address instead of EverWallet:

```bash
npm run utils:wallet-address -- --secret-key <secret-key> --wallet-v5
```

Wallet-v5 keeps a single `--secret-key` argument and accepts either secret-key
representation:

- 64 hex characters: a 32-byte private seed; the public key is derived.
- 128 hex characters: a 32-byte private seed followed by its 32-byte public
  key; the supplied public half is validated.

Use `--secret-file <path>` instead of `--secret-key` to read either representation
from a file:

```bash
npm run utils:wallet-address -- --secret-file ./wallet.secret --wallet-v5
```

Wallet-v5 options:

- `--workchain <number>` defaults to `0`.
- `--network-global-id <number>` defaults to `-239`.
- `--subwallet-number <number>` defaults to `0`.

`--nonce` is not used for wallet-v5 addresses. The script derives the public
key from seed or private-key input, including their file variants, so a 64-hex
private key is enough to compute the address.

Private keys are not printed by default. When seed or private-key input is
used, including their file variants, the script prints the public key first and
then the addresses.

Add `--print-secret-key` to print both secret key formats:

```bash
npm run utils:wallet-address -- --seed "<seed phrase>" --account 0 --print-secret-key
```

With `--print-secret-key`, the script prints:

- `private`: the ordinary 64-hex EverWallet secret key.
- `ton ed25519 secret`: the 128-hex TON Ed25519 secret key for wallet-v5 usage.

`--print-secret-key` is ignored when the script is run with `--public-key`, because
the secret key cannot be recovered from a public key.

## Deposit Watcher

The watcher starts from `/toncenter/v3/masterchainInfo` and scans
`/toncenter/v3/transactionsByMasterchainBlock`, paginating each masterchain
block before the checkpoint advances. A transaction matches when its non-bounced
inbound message and account equal the deposit address and it has no outbound
messages. Matches are printed immediately as JSON lines.

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

The direct response reports:

- `status: "accepted_by_jrpc"` when JRPC accepted the send request.
- `observation: "included"` when the matching wallet transaction was found
  and was not aborted.
- `observation: "aborted"` when the matching wallet transaction was found but
  was aborted.

If the direct client cannot observe the transaction before its timeout, the
command exits with an error rather than returning `not_observed`.

Prepare a signed EverWallet BOC completely offline. This command uses only
local crypto and the bundled WASM; it does not create a JRPC or toncenter
client. Use `--silent` when redirecting its JSON output so npm does not write a
banner into the artifact:

```bash
npm run --silent withdraw:standalone:boc:prepare -- \
  --wallet 0:<everwallet-address> \
  --secret-key <64-hex-secret-key> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25 > signed-everwallet-boc.json
```

The output contains `message.boc`, `message.hash`, `message.expireAt`, and the
signing public key. Transfer the JSON artifact to an online machine and submit
only the signed BOC:

```bash
npm run --silent withdraw:standalone:boc:send -- \
  --boc "$(jq -r '.message.boc' signed-everwallet-boc.json)"
```

`prepare` does not discover `signature_id`; obtain it before going offline and
pass it explicitly. On Tycho testnet it is currently `2000`. Send the BOC
before `message.expireAt` (the default timeout is 60 seconds). The artifact
does not contain the secret key, but anyone holding it can broadcast the signed
transfer until it expires.

The BOC preparation output has no delivery observation:

- `withdraw:standalone:boc:prepare` returns `status: "prepared_offline"` after
  constructing and signing the BOC locally. It makes no network request.

`withdraw:standalone:boc:send` validates the `sendTransaction` BOC locally and
polls the sender wallet for its exact external-message hash. Its response
reports:

- `status: "accepted_by_toncenter"` when Toncenter accepted the BOC.
- `observation: "included"` when the matching wallet transaction was found
  and was not aborted.
- `observation: "aborted"` when the matching wallet transaction was found but
  was aborted.
- `observation: "not_observed"` when the matching BOC was absent through its
  signed expiration and a short grace period.

`accepted_by_toncenter` and even an `included` observation are not proof that
the recipient received funds.

The existing one-step command remains available; it prepares the BOC and
broadcasts it through `/toncenter/v2/sendBocReturnHash` in the same process:

```bash
npm run withdraw:standalone:boc -- \
  --wallet 0:<everwallet-address> \
  --secret-key <64-hex-secret-key> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25
```

For its delivery outcome, it uses the same `status` and `observation` semantics
as `withdraw:standalone:boc:send`.

Options:

- `--rpc <url>` selects JRPC for the direct command.
- `--endpoint <url>` selects toncenter for `withdraw:standalone:boc:send` and the one-step BOC command; offline preparation does not read it.
- `--boc <base64>` is required only by `withdraw:standalone:boc:send`.
- `--bounce` enables bounce for the internal transfer.
- `--comment <text>` adds a text payload during BOC preparation.
- `--signature-id <id>` sets the offline nekoton signature id.
- `--include-state-init` attaches sender EverWallet state init during BOC preparation.
- `--public-key <hex>` overrides the key derived from `--secret-key`.
- `--nonce <uint32>` selects a non-standard sender layout during BOC preparation.

State init is for an undeployed, pre-funded sender. The script validates that
the resulting address matches `--wallet`; omit `--nonce` for a standard
EverWallet.

Check account status:

```bash
curl -sG "https://toncenter-testnet.tychoprotocol.com/toncenter/v2/getWalletInformation" \
  --data-urlencode "address=<wallet-address>" | jq
```

## multisig2 Withdraw

All multisig2 withdraw flows call `submitTransaction`, which supports
one-custodian and M-of-N wallets.

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

The direct response reports:

- `status: "accepted_by_jrpc"` when JRPC accepted the send request.
- `observation: "included"` when the matching wallet transaction was found
  and was not aborted.
- `observation: "aborted"` when the matching wallet transaction was found but
  was aborted.
- `transactionId` only for an included transaction, decoded from the multisig
  response.

If the direct client cannot observe the transaction before its timeout, the
command exits with an error rather than returning `not_observed`.

Prepare a signed `submitTransaction` BOC completely offline. This command uses
only local crypto and the bundled WASM; it does not create a JRPC or toncenter
client:

```bash
npm run --silent withdraw:msig2:boc:prepare -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <custodian-secret-key-hex> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25 > signed-msig2-submit-boc.json
```

Because preparation is fully offline, it cannot perform the `getCustodians`
check. Verify that the signing key is a wallet custodian before disconnecting.

The artifact contains the sender `wallet`, `action`, and `message` with the
signed BOC, its hexadecimal hash, expiration, and signing public key. Transfer
it to an online machine and submit only the BOC:

```bash
npm run --silent withdraw:msig2:boc:send -- \
  --boc "$(jq -r '.message.boc' signed-msig2-submit-boc.json)"
```

The sender derives the multisig wallet address and external-message hash from
the BOC itself, so it needs no `--wallet`. After toncenter accepts the BOC, it
polls that wallet's history through the BOC's signed expiration and decodes the
returned `transactionId` locally. Its response reports:

- `status: "accepted_by_toncenter"` when Toncenter accepted the BOC.
- `observation: "included"` when the matching wallet transaction was found
  and was not aborted.
- `observation: "aborted"` when the matching wallet transaction was found but
  was aborted.
- `observation: "not_observed"` when the matching BOC was absent through its
  signed expiration and a short grace period.
- `transactionId` only for an included transaction, decoded from the multisig
  response.

`not_observed` means the message was not found before the signed expiration;
it does not prove that broadcast failed. Recover it later with
`withdraw:msig2:pending:toncenter`.

The existing one-step command remains available; it prepares, broadcasts, and
observes the BOC in one process:

```bash
npm run withdraw:msig2:boc -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <custodian-secret-key-hex> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25
```

For its delivery outcome, it uses the same `status`, `observation`, and
`transactionId` semantics as `withdraw:msig2:boc:send`.

Options:

- `--rpc <url>` selects JRPC for direct commands.
- `--endpoint <url>` selects toncenter for BOC send, one-step BOC, and history commands; offline preparation does not read it.
- `--boc <base64>` is required only by the separate `*:boc:send` commands.
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

The BOC preparation artifacts and one-step BOC commands print a hexadecimal
`message.hash`, while toncenter returns `in_msg.hash` in base64. Convert it
when exact filtering is needed:

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

The direct response reports:

- `status: "accepted_by_jrpc"` when JRPC accepted the confirmation request.
- `observation: "included"` when the matching wallet transaction was found
  and was not aborted.
- `observation: "aborted"` when the matching wallet transaction was found but
  was aborted.
- `confirmation: "executed"` when this confirmation reached the threshold, or
  `confirmation: "confirmed"` when more signatures are still needed. This
  field is present only for an included transaction.

If the direct client cannot observe the transaction before its timeout, the
command exits with an error rather than returning `not_observed`.

Prepare a signed `confirmTransaction` BOC completely offline:

```bash
npm run --silent withdraw:msig2:confirm:boc:prepare -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <another-custodian-secret-key-hex> \
  --signature-id 2000 \
  --transaction-id <pending-transaction-id> > signed-msig2-confirm-boc.json
```

The artifact also records the normalized `transactionId`. On an online
machine, submit only the signed BOC:

```bash
npm run --silent withdraw:msig2:confirm:boc:send -- \
  --boc "$(jq -r '.message.boc' signed-msig2-confirm-boc.json)"
```

The sender derives the wallet address, `transactionId`, message hash, and
signed expiration from the BOC itself, so it needs no `--wallet`. After
toncenter accepts the BOC, it polls wallet history through the signed expiration
and reports:

- `status: "accepted_by_toncenter"` when Toncenter accepted the BOC.
- `observation: "included"` when the matching wallet transaction was found
  and was not aborted.
- `observation: "aborted"` when the matching wallet transaction was found but
  was aborted.
- `observation: "not_observed"` when the matching BOC was absent through its
  signed expiration and a short grace period.
- `confirmation: "executed"` when this confirmation reached the threshold, or
  `confirmation: "confirmed"` when more signatures are still needed. This
  field is present only for an included transaction.

The existing one-step command remains available when that observed status is
needed:

```bash
npm run withdraw:msig2:confirm:boc -- \
  --wallet 0:<msig2-wallet-address> \
  --secret-key <another-custodian-secret-key-hex> \
  --signature-id 2000 \
  --transaction-id <pending-transaction-id>
```

For its delivery outcome, it uses the same `status`, `observation`, and
`confirmation` semantics as `withdraw:msig2:confirm:boc:send`. A Toncenter
`not_observed` result means the transaction was not found before message
expiration; inspect pending state before retrying.

## `@ton/core` Wallet V5 Withdraw

Prepare a wallet-v5 r1 external message completely offline with `@ton/core`.
For a deployed wallet, obtain its current seqno before going offline and pass
it explicitly: seqno is signed into the BOC and cannot be repaired by the
online sender.

```bash
npm run --silent withdraw:ton-core:boc:prepare -- \
  --wallet 0:<wallet-v5-address> \
  --secret-key <128-hex-ed25519-secret-key> \
  --signature-id 2000 \
  --seqno <current-seqno> \
  --timeout <future-unix-timestamp> \
  --to 0:<recipient> \
  --amount 1.25 > signed-wallet-v5-boc.json
```

The artifact contains `message.boc`, its external `messageHash`, the derived
wallet, signed `seqno`, and `validUntil`. Transfer it to an online machine and
submit only the BOC:

```bash
npm run --silent withdraw:ton-core:boc:send -- \
  --boc "$(jq -r '.message.boc' signed-wallet-v5-boc.json)"
```

`withdraw:ton-core:boc:prepare` returns `status: "prepared_offline"` after
constructing and signing the BOC locally, without a network request.

`withdraw:ton-core:boc:send` parses the wallet address, external message hash,
signed `seqno`, and `validUntil` from the BOC before broadcast, then polls that
wallet's history.
It separates Toncenter acceptance from its local observation:

- `status: "accepted_by_toncenter"` means only that the Toncenter endpoint
  accepted the supplied BOC.
- `observation: "included"` means the matching external BOC was found in the
  wallet history and the wallet transaction was not marked aborted.
- `observation: "aborted"` means the matching wallet transaction was found but
  marked aborted.
- `observation: "not_observed"` means the matching BOC was not found before
  its signed expiration plus a short grace period. For initial `seqno = 0`
  messages, whose Wallet V5 `validUntil` is the `0xffffffff` sentinel, the
  observation window is bounded to 60 seconds.

Neither `included` nor `aborted` proves that the recipient executed the
outgoing transfer; Wallet V5 uses `IGNORE_ERRORS` for this action. Do not send
after `message.validUntil` for a nonzero seqno, and do not use the artifact if
another outgoing message has advanced the wallet seqno.

The existing one-step command remains available. When `--seqno` is omitted, it
looks up seqno through Toncenter, then builds and broadcasts the BOC in one
process and uses the same `status` and `observation` semantics as
`withdraw:ton-core:boc:send`:

```bash
npm run withdraw:ton-core:boc -- \
  --wallet 0:<wallet-v5-address> \
  --secret-key <128-hex-ed25519-secret-key> \
  --signature-id 2000 \
  --to 0:<recipient> \
  --amount 1.25
```

Options:

- `--endpoint <url>` selects Toncenter for `:send` and the one-step command; offline preparation does not read it.
- `--boc <base64>` is required only by `withdraw:ton-core:boc:send`.
- `--seqno <number>` is required by offline preparation for a deployed wallet; the one-step command looks it up when omitted.
- `--workchain <number>` defaults to `0`.
- `--network-global-id <number>` defaults to `-239` and participates in wallet address derivation.
- `--signature-id <number>` prefixes the signed hash; use `2000` on Tycho testnet.
- `--subwallet-number <number>` defaults to `0`.
- `--timeout <unix-timestamp>` sets a nonzero-seqno BOC's signed `valid_until`.
- `--send-mode <number>` defaults to `PAY_GAS_SEPARATELY`; `IGNORE_ERRORS` is added for external auth.
- `--include-state-init` attaches sender state init and defaults an omitted seqno to `0`.
- `--comment <text>` adds a text payload.

`network-global-id` and `signature-id` are separate values: the former changes
the wallet address, while the latter changes only the signed data. If
`--wallet` is supplied, the script verifies it against the secret key,
workchain, network global id, and subwallet number.

## Send Response Format

Every successful withdraw send reports the transport outcome separately from
the observed wallet transaction:

```json
{
  "transport": "...",
  "status": "accepted_by_toncenter | accepted_by_jrpc",
  "observation": "included | aborted | not_observed",
  "wallet": "0:...",
  "action": "...",
  "result": {},
  "transaction": {}
}
```

- Toncenter BOC commands use `status: "accepted_by_toncenter"`. They locate
  the exact external BOC in wallet history by `messageHash`; an
  `observation: "not_observed"` result is normal when it is absent through the
  signed expiry and short grace period.
- Direct JRPC commands use `status: "accepted_by_jrpc"`. The standalone
  client waits for a transaction, so a direct timeout remains a command error
  rather than a JSON `not_observed` response.
- `included` means a matching wallet transaction was found and is not marked
  aborted. `aborted` means the matching wallet transaction is marked aborted.
  Neither result proves recipient-side execution of an outgoing internal
  transfer.

BOC commands additionally emit `messageHash` and `expiresAt`, while preserving
their native signed-expiry field: `expireAt` for Nekoton messages and
`validUntil` for Wallet V5. Multisig submit commands add `transactionId` when
available; multisig confirmation commands add `confirmation: "confirmed"` or
`"executed"` only for an included transaction.

EverWallet BOC send commands also emit `input`, decoded from the signed
`sendTransaction` body, so the online side can inspect the destination, value,
bounce flag, and payload represented by the submitted BOC.

## Detailed Argument Reference

### Transport and endpoint arguments

#### `--rpc <url>`

Selects the Tycho JRPC endpoint used by direct standalone-client commands,
`config:signature-id*`, and `withdraw:msig2:pending:direct`. It overrides
`TYCHO_TESTNET_RPC`; if neither is set, the default is
`https://rpc-testnet.tychoprotocol.com`.

This option does not affect BOC broadcast commands: those use toncenter and
`--endpoint`. Offline BOC preparation uses neither endpoint.

#### `--endpoint <url>`

Selects the toncenter instance used by the deposit watcher, BOC broadcast
commands, and `withdraw:msig2:pending:toncenter`. It overrides
`TYCHO_TESTNET_TONCENTER_ENDPOINT`; the default is
`https://toncenter-testnet.tychoprotocol.com`.

Use it for another network, a staging endpoint, or a local toncenter instance.
It does not affect direct JRPC commands or the offline preparation commands
`withdraw:standalone:boc:prepare`, `withdraw:msig2:boc:prepare`, and
`withdraw:msig2:confirm:boc:prepare`, and `withdraw:ton-core:boc:prepare`.

#### `--boc <base64>`

Required by `withdraw:standalone:boc:send`, `withdraw:msig2:boc:send`, and
`withdraw:msig2:confirm:boc:send`, and `withdraw:ton-core:boc:send`. Pass the
`message.boc` value emitted by the corresponding `*:boc:prepare` command; no
wallet address, amount, or signing key is needed on the online machine. Treat
this value as a signed, broadcast-capable transaction until its signed expiry:
`message.expireAt` for Nekoton messages or `message.validUntil` for Wallet V5.
For
`withdraw:msig2:boc:send` and `withdraw:msig2:confirm:boc:send`, the wallet
address, external-message hash, and signed expiration are parsed from the BOC
before it is broadcast. `withdraw:standalone:boc:send` does the same after
validating an EverWallet `sendTransaction` BOC. `withdraw:ton-core:boc:send`
does the same for its Wallet V5 header. Each uses that hash to observe the
matching wallet transaction.

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
do not accept this option. For wallet-v5, `signature-id` affects only the
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
updated after all transaction pages for a masterchain block are processed, so a
later run can resume from the next block. Omit this option for a stateless scan.

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
Wallet-v5 withdraw accepts a 64-byte Ed25519 secret key (`private || public`)
encoded as 128 hexadecimal characters or base64 and can read it from
`TON_WALLET_SECRET_KEY`. `utils:wallet-address` instead accepts 64-hex private
seeds and 128-hex `private || public` keys through `--secret-key` or
`--secret-file`.

The secret key is used locally and is not sent as an API parameter. It is not
read by any separate `*:boc:send` command.

#### `--public-key <64-hex>`

EverWallet and multisig2 signer public key, or the wallet-v5 address public
key, exactly 32 bytes in hexadecimal.
EverWallet and multisig2 commands normally derive it from `--secret-key`;
`utils:wallet-address` accepts it through `--public-key`.

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

Applies to `withdraw:standalone:boc:prepare` and the one-step
`withdraw:standalone:boc` command. It attaches EverWallet state init to the
external message. Use it only when the sender wallet is not deployed yet, its
future address is already funded, and the first outgoing transfer should deploy
it. It applies to the sender, not the recipient.

The command verifies that the state init derived from the public key and nonce
matches `--wallet`. Omit the option for an active wallet.

#### `--nonce <uint32>`

Applies to `withdraw:standalone:boc:prepare` and the one-step
`withdraw:standalone:boc` command. It selects a non-standard EverWallet data
layout containing a nonce. It must be the same nonce that was used when deriving
the sender address. For a standard EverWallet, omit it.

When supplied without `--include-state-init`, it is still used for sender
address validation but no state init is attached to the BOC.

#### `--timeout <seconds>`

Applies to `withdraw:standalone:boc:prepare` and the one-step
`withdraw:standalone:boc` command. It changes the locally built external
message expiration interval. The default is 60 seconds. The direct EverWallet
command uses standalone-client message handling and does not accept this CLI
value. For offline transfer, choose a value that leaves enough time to send the
artifact before `expireAt`.

### multisig2-specific arguments

#### `--timeout <seconds>`

Changes multisig2 external-message expiration. Direct JRPC commands default to
30 seconds; BOCs built by `*:boc:prepare` and the one-step BOC commands default
to 60 seconds. The one-step toncenter BOC path polls wallet history until
expiration plus a short grace period. `withdraw:msig2:boc:send` reads the same
signed expiration from the BOC and uses it for polling; it does not require a
wallet argument. `withdraw:msig2:confirm:boc:send` does the same and returns
the common observation plus its confirmation-specific result.

#### `--transaction-id <uint64>`

Required by `withdraw:msig2:confirm:direct`, `withdraw:msig2:confirm:boc`, and
`withdraw:msig2:confirm:boc:prepare`. The separate
`withdraw:msig2:confirm:boc:send` command needs only `--boc`. The value accepts
decimal or `0x`-prefixed hexadecimal input and normalizes it to an unsigned
64-bit decimal string. Obtain it from `withdraw:msig2:pending:direct`,
`withdraw:msig2:pending:toncenter`, or the result of the initial submission.

#### `--limit <count>`

Applies to `withdraw:msig2:pending:toncenter` and controls how many recent
wallet transactions are inspected. The default is `50`. Increase it if the
submission is older than the current history window.

The toncenter command infers pending submissions from history; the direct
pending command reads the wallet's current `getTransactions` state.

### Wallet-v5-specific arguments

#### `--seqno <number>`

Overrides the sender wallet sequence number. The value must match current
on-chain state when the message is delivered. Offline
`withdraw:ton-core:boc:prepare` requires it for a deployed wallet; the one-step
command reads it from Toncenter when omitted. If `--include-state-init` is set
and seqno is omitted, both preparation and one-step flows use `0`.

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
wallet. When seqno is not supplied, `withdraw:ton-core:boc:prepare` and the
one-step command use `seqno = 0` instead of calling the get-method.

#### `--timeout <unix-timestamp>`

For an already deployed wallet (`seqno != 0`), sets the absolute Unix
`valid_until` timestamp stored in the signed request. If omitted, BOC
preparation and the one-step command use their build time plus 60 seconds. For
offline transfer, pass an explicit future timestamp with enough time to move
and send the artifact. For `seqno = 0`, wallet-v5 uses `0xffffffff` and ignores
this value. Wallet V5 BOC send flows observe a nonzero-seqno BOC through this
expiration plus a short grace period; the `seqno = 0` sentinel instead uses a
bounded 60-second observation window.

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
