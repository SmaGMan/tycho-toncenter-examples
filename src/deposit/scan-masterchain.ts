import { ToncenterClient } from "../toncenter/client";
import type { DepositMatch } from "./filter-deposit";
import { isDepositTransaction, toDepositMatch } from "./filter-deposit";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";

export type ScanDepositsOptions = {
  client: ToncenterClient;
  depositAddress: string;
  fromSeqno?: number;
  checkpointPath?: string;
  requireNotAborted?: boolean;
  onMatch?: (match: DepositMatch) => void;
};

export async function scanDeposits(options: ScanDepositsOptions): Promise<{
  currentMasterSeqno: number;
  fromSeqno: number;
  matches: DepositMatch[];
}> {
  const currentMasterSeqno = await getCurrentMasterSeqno(options.client);
  const checkpoint = readCheckpoint(options.checkpointPath);
  const fromSeqno = options.fromSeqno ?? (checkpoint == null ? currentMasterSeqno : checkpoint + 1);
  const matches: DepositMatch[] = [];

  for (let seqno = fromSeqno; seqno <= currentMasterSeqno; seqno += 1) {
    const block = await options.client.transactionsByMasterchainBlock(seqno);
    const transactions = block.transactions ?? [];
    for (const tx of transactions) {
      if (isDepositTransaction(tx, {
        depositAddress: options.depositAddress,
        requireNotAborted: options.requireNotAborted,
      })) {
        const match = toDepositMatch(tx);
        matches.push(match);
        options.onMatch?.(match);
      }
    }
    writeCheckpoint(options.checkpointPath, seqno);
  }

  return { currentMasterSeqno, fromSeqno, matches };
}

async function getCurrentMasterSeqno(client: ToncenterClient): Promise<number> {
  const info = await client.masterchainInfo();
  const seqno = info.last?.seqno ?? (info as any).last_seqno ?? (info as any).seqno;
  if (!Number.isInteger(seqno)) {
    throw new Error(`cannot read current masterchain seqno: ${JSON.stringify(info)}`);
  }
  return seqno;
}
