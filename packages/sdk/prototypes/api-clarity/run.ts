import { designs, tasks } from "./contracts";
import { verifyDesign } from "./experiment";
import { measureSource } from "./measure";

const results = [];
for (const design of designs) {
  const source = await Bun.file(new URL(`./${design}.tasks.ts`, import.meta.url)).text();
  const measurements = measureSource(source);
  const verified = await verifyDesign(design);
  for (const { task, operations } of verified) {
    const counts = measurements.get(task);
    if (!counts) throw new Error(`Missing measurement for ${design}.${task}`);
    results.push({ design, task, ...counts, operations });
  }
}

const output = process.argv.indexOf("--json");
if (output !== -1) {
  const path = process.argv[output + 1];
  if (!path) throw new Error("--json requires an output path");
  await Bun.write(path, `${JSON.stringify(results, null, 2)}\n`);
}

console.log("Function-body lexical tokens; columns: current / draft PRD / revised prototype");
console.log("Task | Tokens | Object fields | Control-flow sites");
for (const task of tasks) {
  const rows = results.filter((row) => row.task === task);
  const values = (field: "tokens" | "fields" | "controlFlow") => rows.map((row) => row[field]).join(" / ");
  console.log(`${task} | ${values("tokens")} | ${values("fields")} | ${values("controlFlow")}`);
}
console.log(
  `${results.length} task executions verified. These counts do not measure human comprehension or runtime performance.`,
);
