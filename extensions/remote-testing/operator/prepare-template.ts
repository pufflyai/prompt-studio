async function source(file: string) {
  const result = await Bun.build({ entrypoints: [new URL(file, import.meta.url).pathname], target: "bun" });
  if (!result.success) throw new AggregateError(result.logs, "Could not bundle preview service.");
  return result.outputs[0].text();
}
// Update only the operator-approved preview template. Branch publication still hashes the full spec.
const input = Bun.argv[2];
const output = Bun.argv[3];
if (!input || !output) throw new Error("Pass the approved preview template and output path.");
const template = await Bun.file(input).json();
if (template.metadata.name !== "prompt-studio-preview") throw new Error("Choose the approved preview template.");
template.spec.services["preview-admin"] = {
  baseUrl: "http://127.0.0.1:8082",
  healthPath: "/healthz",
  required: false,
  autostart: true,
  routes: ["/prepare", "/invite"].map((path) => ({
    method: "POST",
    path,
    query: [],
    responseMode: "buffered",
    maxRequestBytes: 4096,
    maxResponseBytes: 4096,
    deadlineSeconds: 12,
  })),
  process: {
    command: ["/usr/local/bin/bun", "-e", await source("./preview-admin.ts")],
    cwd: "/workspace",
    env: {
      PREVIEW_GATE: await source("./preview-gate.ts"),
      PREVIEW_WEBVIEWS: await source("./preview-webviews.ts"),
    },
  },
};
await Bun.write(output, JSON.stringify(template, null, 2) + "\n");
