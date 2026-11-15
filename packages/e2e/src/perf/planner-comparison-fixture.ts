import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { legacyFoobar, pagedFoobar, plannerComparisonSeed } from "./planner-comparison-fixture-sources";

/** Add setup commands to a disposable copy, never the shipped Planner extension. */
export const prepareComparisonSources = (input: {
  root: string;
  plannerSource: string;
  paged: boolean;
  sdk: string;
}) => {
  const planner = join(input.root, "planner");
  cpSync(input.plannerSource, planner, { recursive: true, filter: (path) => basename(path) !== "node_modules" });
  const entry = join(planner, "extension.ts");
  const source = readFileSync(entry, "utf8")
    .replace('import { demoSeed } from "./src/demo-seed";\n', "")
    .replace("    demoSeed,\n", "");
  writeFileSync(
    entry,
    `import { demoSeed } from "./src/demo-seed";\n${source.replace("\n  commands: [", "\n  commands: [\n    demoSeed,")}`,
  );
  writeFileSync(join(planner, "src/demo-seed.ts"), plannerComparisonSeed);
  const foobar = join(input.root, "foobar");
  mkdirSync(foobar, { recursive: true });
  writeFileSync(join(foobar, "extension.ts"), input.paged ? pagedFoobar : legacyFoobar);
  writeFileSync(
    join(foobar, "package.json"),
    JSON.stringify(
      {
        name: "foobar",
        publisher: "demo",
        version: "0.1.0",
        displayName: "Foobar demo",
        private: true,
        type: "module",
        main: "./extension.ts",
        engines: { pstdio: input.paged ? "^0.5.0" : "^0.4.2" },
        dependencies: { "@pstdio/sdk": input.sdk },
      },
      null,
      2,
    ),
  );
  return { planner, foobar };
};

type Marker = { id: string; shorthand: string; index: number };
type Execute = <T = unknown>(command: string, params: Record<string, unknown>) => Promise<T>;

/** Both revisions receive identical data; only bounded setup pages leave the extension. */
export const seedComparisonTickets = async (execute: Execute) => {
  const archiveIds: string[] = [],
    focus: Marker[] = [];
  let parentId = "",
    prerequisite = "",
    movingId = "";
  for (let offset = 0; offset < 5000; offset += 50)
    for (let part = 0; part < 5; part++) {
      const { saved } = await execute<{ saved: Marker[] }>("demo-seed", { offset, part });
      archiveIds.push(...saved.filter(({ index }) => index < 205).map(({ id }) => id));
      focus.push(...saved.filter(({ index }) => index >= 4975));
      parentId = saved.find(({ index }) => index === 0)?.id ?? parentId;
      prerequisite = saved.find(({ index }) => index === 2500)?.id ?? prerequisite;
      movingId = saved.find(({ index }) => index === 4980)?.id ?? movingId;
    }
  await enrichComparisonTickets(execute, focus, parentId, prerequisite);
  return { movingId, archiveIds };
};

export const seedComparisonFoobars = async (execute: Execute) => {
  for (let offset = 0; offset < 5000; offset += 10) await execute("seed", { offset });
};

const enrichComparisonTickets = async (execute: Execute, focus: Marker[], parentId: string, prerequisite: string) => {
  for (const [index, marker] of focus.entries()) {
    const ticket = await execute<{ content: string }>("get-ticket", { id: marker.id });
    await execute("update-ticket", {
      id: marker.id,
      parent: parentId,
      dependsOn: [focus[index - 1]?.id ?? prerequisite],
    });
    const review = await execute<{ id: string }>("request-review", {
      ticket: marker.id,
      title: "Demo scope review",
      instructions: "Synthetic comparison data: confirm the linked scope.",
      request: { kind: "task" },
    });
    for (let revision = 1; revision <= 2; revision++)
      await execute("update-ticket", {
        id: marker.id,
        content: `${ticket.content}\n\nSynthetic comparison revision ${revision}.`,
      });
    if (index % 2) await execute("review", { requestId: review.id, response: { confirmed: true } });
  }
};
