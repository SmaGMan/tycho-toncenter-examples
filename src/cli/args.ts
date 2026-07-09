export class Args {
  private readonly values: string[];

  constructor(values = process.argv.slice(2)) {
    this.values = values;
  }

  get(name: string): string | undefined {
    const index = this.values.indexOf(`--${name}`);
    if (index === -1) return undefined;
    const value = this.values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
    return value;
  }

  require(name: string): string {
    const value = this.get(name);
    if (!value) throw new Error(`--${name} is required`);
    return value;
  }

  flag(name: string): boolean {
    return this.values.includes(`--${name}`);
  }

  int(name: string): number | undefined {
    const value = this.get(name);
    if (value == null) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`--${name} must be an integer`);
    return parsed;
  }

  positiveInt(name: string): number | undefined {
    const parsed = this.int(name);
    if (parsed == null) return undefined;
    if (parsed <= 0) throw new Error(`--${name} must be greater than zero`);
    return parsed;
  }
}

export function strip0x(value: string): string {
  return value.trim().replace(/^0x/i, "");
}

export function hexArg(name: string, value: string, bytes?: number): string {
  const stripped = strip0x(value).toLowerCase();
  const expected = bytes == null ? "+" : `{${bytes * 2}}`;
  if (!new RegExp(`^[0-9a-f]${expected}$`).test(stripped)) {
    throw new Error(`--${name} must be ${bytes ? `${bytes} bytes of ` : ""}hex`);
  }
  return stripped;
}

export function base64OrHexToBuffer(name: string, value: string, expectedBytes?: number): Buffer {
  const normalized = value.trim();
  const asHex = normalized.replace(/^0x/i, "");
  const buffer = /^[0-9a-fA-F]+$/.test(asHex) && asHex.length % 2 === 0
    ? Buffer.from(asHex, "hex")
    : Buffer.from(normalized, "base64");

  if (expectedBytes != null && buffer.length !== expectedBytes) {
    throw new Error(`--${name} must decode to ${expectedBytes} bytes, got ${buffer.length}`);
  }
  return buffer;
}
