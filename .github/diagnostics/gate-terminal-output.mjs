import { readFile, writeFile } from "node:fs/promises";

const path = "packages/e2e/src/ui/extension-webviews.p2.spec.ts";
const marker = "    await addTerminal();\n    await expectVisibleTerminalOutput();";
const source = await readFile(path, "utf8");
if (source.split(marker).length !== 2) throw new Error("Expected one first terminal output assertion");
const gated = String.raw`    const outputGate = await page.addStyleTag({
      content: '[data-workbench-panel="secondary"] .xterm-rows { visibility: hidden !important; }',
    });
    await addTerminal();
    await outputGate.evaluate((style) => {
      const startedAt = performance.now();
      const evidence: { firstOutputMs?: number; releasedMs?: number; observedMs?: number } = {};
      const observe = () => {
        const rows = document.querySelector('[data-workbench-panel="secondary"] .xterm-rows');
        if (!evidence.firstOutputMs && /\S/.test(rows?.textContent ?? ""))
          evidence.firstOutputMs = performance.now() - startedAt;
      };
      const observer = new MutationObserver(observe);
      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      observe();
      const gate = setTimeout(() => {
        evidence.releasedMs = performance.now() - startedAt;
        style.remove();
      }, 1400);
      Reflect.set(window, "recordTerminalOutputGate", () => {
        observe();
        clearTimeout(gate);
        observer.disconnect();
        style.remove();
        return { ...evidence, observedMs: performance.now() - startedAt };
      });
    });
    try {
      await expectVisibleTerminalOutput();
    } finally {
      const evidence = await page.evaluate(() => Reflect.get(window, "recordTerminalOutputGate")());
      console.log("Terminal output gate", evidence);
      await terminalTest.info().attach("terminal-output-gate", { body: JSON.stringify(evidence), contentType: "application/json" });
    }`;
await writeFile(path, source.replace(marker, gated));
