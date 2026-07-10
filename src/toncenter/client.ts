import type {
  MasterchainInfo,
  RunGetMethodResult,
  SendBocResult,
  TransactionsByAccount,
  TransactionsByMasterchainBlock,
} from "./types";

type QueryValue = string | number | boolean | undefined;

export type TransactionsByMasterchainBlockOptions = {
  limit?: number;
  offset?: number;
};

export class ToncenterClient {
  readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint.replace(/\/+$/, "");
  }

  async masterchainInfo(): Promise<MasterchainInfo> {
    return this.getJson("/toncenter/v3/masterchainInfo");
  }

  async transactionsByMasterchainBlock(
    seqno: number,
    options: TransactionsByMasterchainBlockOptions = {},
  ): Promise<TransactionsByMasterchainBlock> {
    return this.getJson("/toncenter/v3/transactionsByMasterchainBlock", {
      seqno,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async transactionsByAccount(address: string, limit = 50): Promise<TransactionsByAccount> {
    return this.getJson("/toncenter/v3/transactions", { account: address, limit });
  }

  async runGetMethod(address: string, method: string, stack: unknown[] = []): Promise<RunGetMethodResult> {
    return this.postJson("/toncenter/v3/runGetMethod", {
      address,
      method,
      stack,
    });
  }

  async sendBocReturnHash(boc: string): Promise<SendBocResult> {
    return this.postJson("/toncenter/v2/sendBocReturnHash", { boc });
  }

  private async getJson<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = new URL(`${this.endpoint}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    return this.requestJson<T>(url, { method: "GET" });
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(`${this.endpoint}${path}`);
    return this.requestJson<T>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${init.method} ${url.toString()} returned non-JSON: ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(`${init.method} ${url.toString()} failed: ${response.status} ${JSON.stringify(json)}`);
    }

    if (json && typeof json === "object" && "ok" in json && json.ok === false) {
      throw new Error(`${init.method} ${url.toString()} failed: ${JSON.stringify(json)}`);
    }

    return "result" in json && Object.keys(json).length <= 2 ? json.result as T : json as T;
  }
}

export function readSeqnoFromRunGetMethod(result: RunGetMethodResult): number {
  const body = result.result ?? result;
  const exitCode = body.exit_code ?? body.exitCode ?? 0;
  if (exitCode !== 0) throw new Error(`seqno get-method failed with exit code ${exitCode}`);

  const value = body.stack?.[0];
  const parsed = parseStackNumber(value);
  if (parsed == null) {
    throw new Error(`cannot parse seqno from runGetMethod response: ${JSON.stringify(result)}`);
  }
  return parsed;
}

function parseStackNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseNumberString(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseStackNumber(item);
      if (parsed != null) return parsed;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["num", "value", "number"]) {
      const parsed = parseStackNumber(record[key]);
      if (parsed != null) return parsed;
    }
  }

  return undefined;
}

function parseNumberString(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = trimmed.startsWith("0x") || trimmed.startsWith("-0x")
    ? Number(BigInt(trimmed))
    : Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
