export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printJsonLine(value: unknown): void {
  console.log(JSON.stringify(value));
}
