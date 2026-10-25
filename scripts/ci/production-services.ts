import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireProductionBuild } from "./production-artifacts";
import { assertProductionPayload } from "./production-payload";

const run = (command: string[]) => {
  const result = spawnSync(command[0]!, command.slice(1), { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) throw new Error(`Production service input failed: ${command.join(" ")}`);
  return result.stdout.trim();
};
const candidate = await Bun.file("production-candidate.json").json();
const images: Record<string, string> = {};
for (const service of ["relay", "account-manager"]) {
  const path = `service-images/${service}.tar`;
  const identity = await Bun.file(`service-images/${service}-identity.json`).json();
  requireProductionBuild(identity, candidate);
  await assertProductionPayload({ ...identity, payloadName: path });
  if (service === "relay")
    await Bun.write("production-build-identity.json", JSON.stringify({ ...identity, payloadName: path }));
  run(["docker", "load", "--input", path]);
  const manifest = JSON.parse(run(["tar", "-xOf", path, "manifest.json"]));
  const tag = manifest[0]?.RepoTags?.[0] as string | undefined;
  if (!tag || !/^ghcr\.io\/[a-z0-9._/-]+:[a-z0-9._-]+$/.test(tag))
    throw new Error(`Invalid production image identity for ${service}`);
  images[service === "relay" ? "relay" : "manager"] = run(["docker", "image", "inspect", tag, "--format", "{{.Id}}"]);
}
for (const image of Object.values(images)) {
  const version = run(["docker", "run", "--rm", image, "bun", "--version"]);
  if (`bun-${version}` !== candidate.toolchain)
    throw new Error("The published service runtime uses a different Bun toolchain");
}
await Bun.write("production-service-images.json", JSON.stringify(images, null, 2));
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Published service image IDs\n\n${JSON.stringify(images, null, 2)}\n`,
  );
const result = Bun.spawn(
  [
    "bun",
    resolve(import.meta.dirname, "../../infra/relay/smoke-portable.ts"),
    "--prebuilt-images",
    "production-service-images.json",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
process.exitCode = await result.exited;
