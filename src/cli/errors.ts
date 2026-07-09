export async function runMain(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
