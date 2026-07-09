import { Args } from "../../src/cli/args";
import { toncenterEndpoint } from "../../src/cli/env";
import { runMain } from "../../src/cli/errors";
import { printJsonLine } from "../../src/cli/format";
import { scanDeposits } from "../../src/deposit/scan-masterchain";
import { ToncenterClient } from "../../src/toncenter/client";

runMain(async () => {
  const args = new Args();
  const client = new ToncenterClient(toncenterEndpoint(args.get("endpoint")));
  const depositAddress = args.require("address");
  const checkpointPath = args.get("checkpoint");
  const pollMs = args.positiveInt("poll-ms");
  let fromSeqno = args.int("from");

  do {
    const result = await scanDeposits({
      client,
      depositAddress,
      checkpointPath,
      fromSeqno,
      requireNotAborted: args.flag("require-not-aborted"),
      onMatch: printJsonLine,
    });
    fromSeqno = undefined;

    if (!pollMs) {
      if (result.matches.length === 0) {
        console.log(`no deposits found from masterchain seqno ${result.fromSeqno} to ${result.currentMasterSeqno}`);
      }
      return;
    }

    await new Promise(resolve => setTimeout(resolve, pollMs));
  } while (true);
});
