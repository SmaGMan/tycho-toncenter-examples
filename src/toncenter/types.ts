export type MasterchainInfo = {
  last?: BlockId;
  state_root_hash?: string;
  init?: BlockId;
  [key: string]: unknown;
};

export type BlockId = {
  workchain?: number;
  workchain_id?: number;
  shard?: string;
  shard_id?: string;
  seqno: number;
  root_hash?: string;
  file_hash?: string;
};

export type ToncenterMessage = {
  source?: string | null;
  src?: string | null;
  destination?: string | null;
  dst?: string | null;
  value?: string | number;
  bounced?: boolean;
  bounce?: boolean;
  body?: string | null;
  message_content?: {
    body?: string | null;
  } | null;
  messageContent?: {
    body?: string | null;
  } | null;
  hash?: string;
  [key: string]: unknown;
};

export type ToncenterTransaction = {
  account?: string;
  account_addr?: string;
  hash?: string;
  lt?: string | number;
  now?: number;
  aborted?: boolean;
  in_msg?: ToncenterMessage | null;
  inMessage?: ToncenterMessage | null;
  out_msgs?: ToncenterMessage[];
  outMessages?: ToncenterMessage[];
  [key: string]: unknown;
};

export type TransactionsByMasterchainBlock = {
  transactions?: ToncenterTransaction[];
  [key: string]: unknown;
};

export type TransactionsByAccount = {
  transactions?: ToncenterTransaction[];
  [key: string]: unknown;
};

export type SendBocResult = {
  hash?: string;
  message_hash?: string;
  boc_hash?: string;
  [key: string]: unknown;
};

export type RunGetMethodResult = {
  exit_code?: number;
  exitCode?: number;
  stack?: unknown[];
  result?: {
    exit_code?: number;
    exitCode?: number;
    stack?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
