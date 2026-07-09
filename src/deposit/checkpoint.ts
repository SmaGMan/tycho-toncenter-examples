import fs from "fs";

export function readCheckpoint(path: string | undefined): number | undefined {
  if (!path || !fs.existsSync(path)) return undefined;
  const content = JSON.parse(fs.readFileSync(path, "utf8")) as { lastProcessedMasterSeqno?: number };
  return content.lastProcessedMasterSeqno;
}

export function writeCheckpoint(path: string | undefined, lastProcessedMasterSeqno: number): void {
  if (!path) return;
  fs.writeFileSync(path, JSON.stringify({ lastProcessedMasterSeqno }, null, 2));
}
