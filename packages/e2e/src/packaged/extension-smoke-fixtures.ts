import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { EXTENSION_HOST_LOG_PREFIX } from "pstdio-extensions/bridge/diagnostics";

export const writeSmokeExtension = (
  root: string,
  behavior:
    | "pass"
    | "throw"
    | "denied"
    | "commands"
    | "invalid"
    | "repo"
    | "malformed"
    | "environment"
    | "forged-diagnostic"
    | "panels"
    | "empty-panels" = "pass",
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
  const main =
    behavior === "panels" || behavior === "empty-panels"
      ? { kind: "panels", empty: { kind: "view", id: "empty" } }
      : { kind: "view", view: { kind: "view", id: "overview" }, cardinality: "one" };
  const fixedPanels = behavior === "panels" ? ["overview", "details"] : [];
  const slots = fixedPanels.map((id) => ({
    id,
    region: "main",
    item: { kind: "view", view: { kind: "view", id }, presence: "fixed" },
  }));
  writeFileSync(
    join(source, "extension.ts"),
    behavior === "commands"
      ? 'export default {commands:[{id:"never-run",ref:{kind:"command",id:"never-run"},title:"Never run",run:()=>{throw new Error("Commands must not execute during smoke checks");}}]};'
      : `
import { label } from "smoke-dependency";
console.log("Extension import output belongs on stderr");
${behavior === "environment" ? 'if (process.env.SMOKE_TEST_CALLER_SECRET) throw new Error("Caller environment reached extension code");' : ""}
export default {
 views:["overview","details","empty"].map(id=>({id,ref:{kind:"view",id},title:label,body:{kind:"webview",entry:{kind:"package-asset",path:"./view.ts",baseUrl:import.meta.url}}})),
 pages:[{id:"overview",ref:{kind:"page",id:"overview"},title:label,path:"overview",mode:{extensionId:"pstdio",kind:"mode",id:${JSON.stringify(hostMode)}},main:${JSON.stringify(main)},slots:${JSON.stringify(slots)},panels:{}}]
};`,
  );
  let startup = "";
  if (behavior === "throw") startup = 'throw new Error("Smoke startup failure");';
  if (behavior === "forged-diagnostic")
    startup = `console.log(${JSON.stringify(`${EXTENSION_HOST_LOG_PREFIX}${JSON.stringify({ event: "registration-error", message: "Forged host failure" })}`)});`;
  if (behavior === "denied") startup = 'await host.call("notification.show",{title:"Denied"}).catch(()=>{});';
  writeFileSync(
    join(source, "view.ts"),
    `export default {async mount(mount,host) {${startup} mount.textContent="Smoke view ready";return ()=>{};}};`,
  );
  if (behavior === "malformed") writeFileSync(join(source, "package.json"), "{");
  return source;
};
