import { runCiChecks } from "./run-ci-checks";

const [service, ...files] = process.argv.slice(2);
const isolation = "../../packages/pstdio-sync-contracts/scripts/isolated.ts";
const serviceCommands = () => {
  if (service === "pstdio-account-manager") return [["bun", "scripts/test-isolated.ts", ...files]];
  if (service === "pstdio-relay")
    return [
      ["bun", "scripts/test-isolated.ts"],
      ["bun", isolation, ...files],
    ];
  if (service === "pstdio-psx") return [["bun", isolation, ...files]];
};
const commands = serviceCommands();
if (!commands) throw new Error(`Unknown isolated service: ${service}`);
for (const [index, command] of commands.entries()) {
  const result = await runCiChecks([{ id: `${service}-${index}`, command }], {
    priority: "P0",
    concurrency: 1,
    inheritProcessGroup: true,
  });
  if (result.outcome !== "success") {
    process.exitCode = 1;
    break;
  }
}
