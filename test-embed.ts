import "./_embed-manifest.generated";
const files = Bun.embeddedFiles as (Blob & { name: string })[];
console.log("Total embedded:", files.length);
const cliFiles = files.filter((f) => f.name.startsWith("packages/pstdio/files/"));
console.log("CLI files:", cliFiles.length);
for (const f of cliFiles) console.log("  ", f.name);
const dashFiles = files.filter((f) => f.name.startsWith("packages/pstdio-dashboard/"));
console.log("Dashboard files:", dashFiles.length, "(first 3)");
for (const f of dashFiles.slice(0, 3)) console.log("  ", f.name);
