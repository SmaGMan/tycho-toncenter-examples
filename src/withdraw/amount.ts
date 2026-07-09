const NATIVE_DECIMALS = 9;

export function toNanoString(value: string): string {
  const input = value.trim();
  if (!/^\d+(\.\d+)?$/.test(input)) throw new Error(`invalid native amount: ${value}`);

  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > NATIVE_DECIMALS) {
    throw new Error(`native amount supports at most ${NATIVE_DECIMALS} decimals`);
  }

  const paddedFraction = fraction.padEnd(NATIVE_DECIMALS, "0");
  return (BigInt(whole) * 1_000_000_000n + BigInt(paddedFraction || "0")).toString();
}
