// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./src-Bie5yc-F.ts";
import { n as t } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import { c as n } from "./chunk-I66GZJ75-3HfQzheA.ts";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/chunk-KBJHAD2P.mjs
var r = /* @__PURE__ */ t((t, r, o, s) => {
	t.attr("class", o);
	let { width: c, height: l, x: u, y: d } = i(t, r);
	n(t, l, c, s);
	let f = a(u, d, c, l, r);
	t.attr("viewBox", f), e.debug(`viewBox configured: ${f} with padding: ${r}`);
}, "setupViewPortForSVG"), i = /* @__PURE__ */ t((e, t) => {
	let n = e.node()?.getBBox() || {
		width: 0,
		height: 0,
		x: 0,
		y: 0
	};
	return {
		width: n.width + t * 2,
		height: n.height + t * 2,
		x: n.x,
		y: n.y
	};
}, "calculateDimensionsWithPadding"), a = /* @__PURE__ */ t((e, t, n, r, i) => `${e - i} ${t - i} ${n} ${r}`, "createViewBox");
export { r as t };
