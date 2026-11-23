import { join } from "node:path";
import { hostClient, type LocalRuntime } from "./host-setup";

export async function installExtensions(input: {
  root: string;
  checkout: string;
  home: string;
  runtime: LocalRuntime;
  projectId: string;
}) {
  const host = hostClient(input.runtime, input.projectId);
  for (const name of ["cloud-workspaces", "remote-testing"]) {
    const child = Bun.spawn(
      ["pst", "extensions", "add", join(input.checkout, "extensions", name), "--name", name, "--force"],
      {
        cwd: input.root,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    if (await child.exited) throw new Error(`Could not install ${name}. Check Prompt Studio and package dependencies.`);
    const { extensions } = (await host("/extensions")) as {
      extensions: { id: string; installName: string; enabled: boolean }[];
    };
    const existing = extensions.find((e) => e.installName === name);
    if (existing) {
      if (!existing.enabled) await host(`/extensions/${existing.id}`, "PATCH", { enabled: true });
      continue;
    }
    const sourcePath = join(input.home, "extensions", name);
    const manifest = await Bun.file(join(sourcePath, "package.json")).json();
    await host(`/extensions/installed/${name}/enable`, "POST", {
      displayName: manifest.displayName ?? manifest.name,
      extensionId: `${manifest.publisher}.${manifest.name}`,
      manifest,
      name: manifest.name,
      sourceKind: "local_path",
      sourcePath,
      version: manifest.version,
    });
  }
}
