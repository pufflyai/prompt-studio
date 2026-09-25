export {};

const path = "clients/desktop/src/e2e/packaged-app-helpers.ts";
let source = await Bun.file(path).text();
source = `import { execFileSync as inspectHandles } from "node:child_process";\nimport { basename as handleSearchName } from "node:path";\n${source}`;
source = source.replace(
  "  await removePackagedDirectory(home);",
  `  try {
    await removePackagedDirectory(home);
  } catch (error) {
    console.error("CLEANUP RUNTIME", process.execPath, process.version, JSON.stringify({ pid: runtime?.pid, ownerType: runtime?.ownerType }));
    try { console.error(inspectHandles("handle64.exe", ["-accepteula", "-nobanner", handleSearchName(home)], { encoding: "utf8" })); }
    catch (inspection) { console.error(String((inspection as { stdout?: unknown }).stdout)); }
    throw error;
  }`,
);
await Bun.write(path, source);
