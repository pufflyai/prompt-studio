import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./run";

test("runs a measured checkout with the previously published CLI protocol", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchmark-previous-cli-"));
  try {
    const source = join(root, "checkout", "packages", "benchmarks", "src");
    await mkdir(source, { recursive: true });
    // This measured checkout accepts the original CLI options. New runner metadata must not
    // add an argument that an existing release cannot parse.
    await writeFile(
      join(source, "cli.ts"),
      `
import {parseArgs} from "node:util";
import {appendFileSync} from "node:fs";
const {positionals,values}=parseArgs({allowPositionals:true,options:{
 suites:{type:"string"},suite:{type:"string"},sha:{type:"string"},cache:{type:"string"},out:{type:"string"}
}});
if(positionals[0]==="describe")console.log(JSON.stringify([{id:"example",label:"Example",source:"example.p3.bench.ts"}]));
if(positionals[0]==="sample")appendFileSync(values.out!,JSON.stringify({metric:"work",label:"Work",unit:"ms",value:1})+"\\n");
`,
    );
    const output = join(root, "results");
    expect(
      await run({
        checkouts: [{ dir: join(root, "checkout"), sha: "previous" }],
        suites: ["example"],
        samples: 2,
        cache: join(root, "cache"),
        out: output,
        platform: "linux-x64",
      }),
    ).toEqual([]);
    const result = JSON.parse(await readFile(join(output, "previous-linux-x64.json"), "utf8"));
    expect(result.metrics[0].values).toEqual([1, 1]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
