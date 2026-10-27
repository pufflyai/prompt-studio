// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./src-Bie5yc-F.ts";
import { n as t } from "./mermaid-parser.core-CQOZNFIk.ts";
import { n } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import { c as r } from "./chunk-I66GZJ75-3HfQzheA.ts";
import { o as i } from "./mermaid-renderer-DxExU8WG.ts";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-6WML65LV.mjs
var a = { parse: /* @__PURE__ */ n(async (n) => {
	let r = await t("info", n);
	e.debug(r);
}, "parse") }, o = { version: "11.16.1" }, s = {
	parser: a,
	db: { getVersion: /* @__PURE__ */ n(() => o.version, "getVersion") },
	renderer: { draw: /* @__PURE__ */ n((t, n, a) => {
		e.debug("rendering info diagram\n" + t);
		let o = i(n);
		r(o, 100, 400, !0), o.append("g").append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${a}`);
	}, "draw") }
};
export { s as diagram };
