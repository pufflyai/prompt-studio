import { readFile, writeFile } from "node:fs/promises";

const path = "packages/e2e/src/ui/extension-webviews.p2.spec.ts";
const marker = "    await addTerminal();\n    await expectVisibleTerminalOutput();";
const helper = "    const expectVisibleTerminalOutput = async () => {";
const source = await readFile(path, "utf8");
if (source.split(marker).length !== 2 || source.split(helper).length !== 2) {
  throw new Error("Expected one first terminal output assertion");
}
const probe = String.raw`    let onTerminalOutputSample: (() => Promise<void>) | undefined;
    const sampleTerminalOutput = async () => {
      const text = await visibleTerminalText();
      await onTerminalOutputSample?.();
      return text;
    };
`;
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
      Reflect.set(window, "releaseTerminalOutputGate", () => {
        evidence.releasedMs = performance.now() - startedAt;
        style.remove();
      });
      Reflect.set(window, "recordTerminalOutputGate", () => {
        observe();
        observer.disconnect();
        style.remove();
        return { ...evidence, observedMs: performance.now() - startedAt };
      });
    });
    const observationStartedAt = performance.now();
    let outputSamples = 0;
    onTerminalOutputSample = async () => {
      if (++outputSamples !== 4) return;
      const untilObservedGap = 1100 - (performance.now() - observationStartedAt);
      if (untilObservedGap > 0) await new Promise((resolve) => setTimeout(resolve, untilObservedGap));
      await page.evaluate(() => Reflect.get(window, "releaseTerminalOutputGate")());
    };
    try {
      await expectVisibleTerminalOutput();
    } finally {
      onTerminalOutputSample = undefined;
      const evidence = {
        ...await page.evaluate(() => Reflect.get(window, "recordTerminalOutputGate")()),
        outputSamples,
      };
      console.log("Terminal output gate", evidence);
      await terminalTest.info().attach("terminal-output-gate", { body: JSON.stringify(evidence), contentType: "application/json" });
    }`;
await writeFile(
  path,
  source
    .replace(helper, probe + helper)
    .replace("expect.poll(visibleTerminalText,", "expect.poll(sampleTerminalOutput,")
    .replace(marker, gated),
);
