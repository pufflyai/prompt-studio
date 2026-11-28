import { createHash } from "node:crypto";

// Preserve all operator values and preview services while changing the runtime pin.
type ApprovedTemplate = {
  metadata: { name: string; [key: string]: unknown };
  spec: {
    image: string;
    version: string;
    resources: { ephemeralStorage?: string; [key: string]: unknown };
    lifecycle: {
      persistence: { mounts: { target: string; maxBytes: number; [key: string]: unknown }[] };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export function testTemplate(template: ApprovedTemplate, image: string) {
  if (!["remote-tests", "prompt-studio-preview"].includes(template.metadata.name))
    throw new Error("Choose an approved test or preview base.");
  if (!/@sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Pin the equipped runtime by image digest.");
  const result = structuredClone(template);
  result.spec.image = image;
  result.spec.resources.ephemeralStorage = "48Gi";
  const workspace = result.spec.lifecycle.persistence.mounts.find(
    (mount: { target: string }) => mount.target === "/workspace",
  );
  if (!workspace) throw new Error("The test runtime requires a workspace volume.");
  workspace.maxBytes = 40 * 1024 ** 3;
  result.spec.version = `1.0.0-docker-${createHash("sha256").update(JSON.stringify(result.spec)).digest("hex").slice(0, 16)}`;
  return result;
}
if (import.meta.main) {
  const [input, image, output] = Bun.argv.slice(2);
  if (!input || !image || !output) throw new Error("Pass approved-base.json image@sha256:digest equipped-base.json.");
  await Bun.write(output, `${JSON.stringify(testTemplate(await Bun.file(input).json(), image), null, 2)}\n`);
}
