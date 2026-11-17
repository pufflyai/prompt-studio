import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRendererReadRegistry } from "../../core/registries/views/renderer-read-registry";

// Probe the actual host read owner rather than inventing a serial panel baseline.
// The callbacks are held prerequisites, not a simulated measurement of server/editor latency.
const args = process.argv.slice(2);
assert(args.includes("--out"), "Pass --out <report filesPath>");
const output = resolve(args[args.indexOf("--out") + 1]);
await mkdir(output, { recursive: true });
const registry = createRendererReadRegistry();
const editor = registry.bind("ps239-editor");
const properties = registry.bind("ps239-properties");
const files = registry.bind("ps239-files");
const links = registry.bind("ps239-links");
const admission = Promise.withResolvers<void>();
const secondary = Promise.withResolvers<void>();
const allStarted = Promise.withResolvers<void>();
const editorReady = Promise.withResolvers<void>();
let started = 0;
let editable = false;
const events: { phase: string; at: number }[] = [];
const errors: string[] = [];
const mark = (phase: string) => events.push({ phase, at: performance.now() });
const entered = () => {
  if (++started === 4) allStarted.resolve();
};
const pending: Promise<void>[] = [];
try {
  pending.push(
    properties.request({
      queryKey: "properties",
      load: async () => {
        entered();
        await secondary.promise;
        return "properties";
      },
      onValue: () => mark("properties-ready"),
      onError: (error) => errors.push(String(error)),
    }),
  );
  pending.push(
    files.request({
      queryKey: "files",
      load: async () => {
        entered();
        await secondary.promise;
        return "files";
      },
      onValue: () => mark("files-ready"),
      onError: (error) => errors.push(String(error)),
    }),
  );
  pending.push(
    links.request({
      queryKey: "links",
      load: async () => {
        entered();
        await secondary.promise;
        throw new Error("relationship preview failed");
      },
      onValue: () => mark("links-ready"),
      onError: (error) => {
        errors.push(String(error));
        mark("links-error-visible");
      },
    }),
  );
  pending.push(
    editor.request({
      queryKey: "body",
      load: async () => {
        entered();
        mark("editor-source-validation-start");
        await admission.promise;
        mark("editor-source-validation-finished");
        return "validated source";
      },
      onValue: () => {
        editable = true;
        mark("editor-ready");
        editorReady.resolve();
      },
      onError: editorReady.reject,
    }),
  );
  await allStarted.promise;
  assert.equal(editable, false, "An editor cannot bypass required admission");
  admission.resolve();
  await editorReady.promise;
  assert.equal(editable, true);
  assert(!events.some((entry) => entry.phase === "properties-ready" || entry.phase === "files-ready"));
  mark("asserted-editor-ready-with-panels-held");
  secondary.resolve();
  await Promise.all(pending);
  assert.equal(errors.length, 1);
  assert(errors[0].includes("relationship preview failed"));
  assert.equal(editable, true, "A secondary error cannot remove an admitted editor");
  await Bun.write(
    resolve(output, "evidence.json"),
    JSON.stringify(
      {
        status: "passed",
        productionRegistryAlreadyIndependent: true,
        requiredAdmissionRetained: true,
        panelFailureDelivered: true,
        events,
        errors,
        scope: "Host renderer read contract probe; no native editor/browser latency claim",
        unrun: [
          "full creation/open request waterfall",
          "rich-text render and immediate typing",
          "populated relationship panels",
          "cached source reuse",
          "combined V4",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  admission.resolve();
  secondary.resolve();
  editor.dispose();
  properties.dispose();
  files.dispose();
  links.dispose();
  await registry.dispose();
}
console.log(JSON.stringify({ output, status: "passed" }));
