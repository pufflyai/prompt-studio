import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeSmokeExtension = (
  root: string,
  behavior: "pass" | "throw" | "denied" | "commands" | "invalid" | "repo" | "malformed" = "pass",
) => {
  const source = join(root, "extension");
  mkdirSync(join(source, "dependency"), { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "smoke",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      ...(behavior === "repo" ? { pstdio: { scope: "repo" } } : {}),
      dependencies: { "smoke-dependency": "file:./dependency" },
    }),
  );
  writeFileSync(
    join(source, "dependency/package.json"),
    JSON.stringify({ name: "smoke-dependency", version: "1.0.0", type: "module", exports: "./index.ts" }),
  );
  writeFileSync(join(source, "dependency/index.ts"), 'export const label="Smoke page";');
  const hostMode = behavior === "invalid" ? "missing" : "project";
  writeFileSync(
    join(source, "extension.ts"),
    behavior === "commands"
      ? 'export default {commands:[{id:"never-run",ref:{kind:"command",id:"never-run"},title:"Never run",run:()=>{throw new Error("Commands must not execute during smoke checks");}}]};'
      : `
import { label } from "smoke-dependency";
console.log("Extension import output belongs on stderr");
export default {
 views:[{id:"overview",ref:{kind:"view",id:"overview"},title:label,body:{kind:"webview",entry:{kind:"package-asset",path:"./view.ts",baseUrl:import.meta.url}}}],
 pages:[{id:"overview",ref:{kind:"page",id:"overview"},title:label,path:"overview",mode:{extensionId:"pstdio",kind:"mode",id:${JSON.stringify(hostMode)}},main:{kind:"view",view:{kind:"view",id:"overview"},cardinality:"one"},slots:[],panels:{}}]
};`,
  );
  const startup =
    behavior === "throw"
      ? 'throw new Error("Smoke startup failure");'
      : behavior === "denied"
        ? 'await host.call("notification.show",{title:"Denied"}).catch(()=>{});'
        : "";
  writeFileSync(
    join(source, "view.ts"),
    `export default {async mount(mount,host) {${startup} mount.textContent="Smoke view ready";return ()=>{};}};`,
  );
  if (behavior === "malformed") writeFileSync(join(source, "package.json"), "{");
  return source;
};
