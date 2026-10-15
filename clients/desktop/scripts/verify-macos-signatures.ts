import { resolve } from "node:path";
import { verifyMacOSAppTrust } from "../src/release/macos-app-trust";

if (process.platform !== "darwin") throw new Error("macOS signature verification requires macOS");
const appPath = process.argv[2];
if (!appPath || process.argv.length !== 3) {
  throw new Error("Usage: verify-macos-signatures.ts <Prompt Studio.app>");
}
await verifyMacOSAppTrust(resolve(appPath));
console.log(
  "Prompt Studio application and runtime identities, signatures, notarization, and Gatekeeper trust verified.",
);
