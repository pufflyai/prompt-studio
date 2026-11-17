import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readClaudeUsage } from "./quota-probe";

test("Quota inspection sends control requests only and waits for its process to close", async () => {
  const dir = await mkdtemp(join(tmpdir(), "claude-quotas-"));
  const fixture = join(dir, "native.ts");
  try {
    await writeFile(
      fixture,
      `
      import {createInterface} from "node:readline";
      let initialized = false;
      for await (const line of createInterface({input:process.stdin})) {
        const request = JSON.parse(line);
        if(request.type !== "control_request") process.exit(2);
        const subtype = request.request.subtype;
        if(subtype === "initialize") initialized = true;
        else if(subtype !== "get_usage" || !initialized || request.request.skip_behaviors !== true) process.exit(3);
        const response = subtype === "initialize" ? {} : {
          pid:process.pid, rate_limits:{five_hour:{utilization:25}}
        };
        console.log(JSON.stringify({type:"control_response",response:{
          subtype:"success",request_id:request.request_id,response
        }}));
      }
    `,
    );
    const result = await readClaudeUsage(undefined, [process.execPath, fixture]);
    expect(result.rate_limits).toEqual({ five_hour: { utilization: 25 } });
    expect(() => process.kill(result.pid as number, 0)).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Quota inspection respects cancellation before starting a native process", async () => {
  await expect(readClaudeUsage(AbortSignal.abort(new Error("Cancelled")), ["missing-cli"])).rejects.toThrow(
    "Cancelled",
  );
});
