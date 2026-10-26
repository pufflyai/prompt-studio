import { open } from "node:fs/promises";
import type { Browser } from "@playwright/test";

const peMachine = async (path: string) => {
  const file = await open(path, "r");
  try {
    const header = Buffer.alloc(64);
    await file.read(header, 0, header.length, 0);
    if (header.toString("ascii", 0, 2) !== "MZ") throw new Error(`Not a PE executable: ${path}`);
    const pe = Buffer.alloc(6);
    await file.read(pe, 0, pe.length, header.readUInt32LE(0x3c));
    if (pe.readUInt32LE(0) !== 0x4550) throw new Error(`Invalid PE signature: ${path}`);
    return `0x${pe.readUInt16LE(4).toString(16)}`;
  } finally {
    await file.close();
  }
};

export const traceBrowserArchitecture = async (browser: Browser) => {
  const session = await browser.newBrowserCDPSession();
  try {
    const { arguments: args } = await session.send("Browser.getBrowserCommandLine");
    const path = args[0];
    if (!path) throw new Error("Browser command line did not name its executable");
    const machine = await peMachine(path);
    const result = {
      path,
      machine,
      channel: process.env.PSTDIO_QUALIFY_BROWSER_CHANNEL,
      host: { platform: process.platform, arch: process.arch },
      version: browser.version(),
      runtimeMachine: await peMachine(process.env.E2E_PACKAGED_BINARY_PATH!),
    };
    console.log(`Browser architecture: ${JSON.stringify(result)}`);
    if (result.channel === "msedge" && machine !== "0xaa64") throw new Error("Candidate Edge browser is not ARM64");
  } finally {
    await session.detach();
  }
};
