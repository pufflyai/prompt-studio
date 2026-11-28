// Minimal dependency-free extension: publication must work without a locally installed SDK.
export const probeManifest = {
  name: "team-probe",
  publisher: "example",
  version: "1.0.0",
  type: "module",
  main: "extension.ts",
  engines: { pstdio: "^0.6.0" },
};
export const probeSource = `export default { commands: [
  { id: "read", ref: { kind: "command", id: "read" }, title: "Read shared value",
    async run(ctx) { return (await ctx.storage.records.read(ctx.storage.records.id("shared")))?.value ?? null; } },
  { id: "write", ref: { kind: "command", id: "write" }, title: "Write shared value", mutating: true,
    params: { value: { type: "string", required: true } },
    async run(ctx, params) {
      await ctx.storage.records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId: ctx.storage.records.id("shared"), replace: { text: params.value } }] });
      return true;
    } },
] };`;
