// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./src-Bie5yc-F.ts";
import { m as t, t as n } from "./mermaid-parser.core-CQOZNFIk.ts";
import { n as r } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import "./chunk-I66GZJ75-3HfQzheA.ts";
import "./mermaid-renderer-DxExU8WG.ts";
import { n as i, r as a, t as o } from "./chunk-6Q2QTUOP-pxLrNWXQ.ts";
import { t as s } from "./chunk-JWPE2WC7-nGp8ldvS.ts";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/abnfDiagram-N423BO3Z.mjs
var c = t().RailroadAbnf.parser.LangiumParser, l = /* @__PURE__ */ r((e) => {
	let t = e.alternatives.map(u);
	return t.length === 1 ? t[0] : {
		type: "choice",
		alternatives: t
	};
}, "transformAlternation"), u = /* @__PURE__ */ r((e) => {
	let t = e.elements.map(f);
	return t.length === 1 ? t[0] : {
		type: "sequence",
		elements: t
	};
}, "transformConcatenation"), d = /* @__PURE__ */ r((e) => {
	if (e.includes("*")) {
		let [t, n] = e.split("*");
		return {
			min: t ? parseInt(t, 10) : 0,
			max: n ? parseInt(n, 10) : Infinity
		};
	}
	let t = parseInt(e, 10);
	return {
		min: t,
		max: t
	};
}, "parseRepeat"), f = /* @__PURE__ */ r((e) => {
	let t = p(e.primary);
	if (!e.repeat) return t;
	let { min: n, max: r } = d(e.repeat);
	return n === 0 && r === 1 ? {
		type: "optional",
		element: t
	} : {
		type: "repetition",
		element: t,
		min: n,
		max: r
	};
}, "transformElement"), p = /* @__PURE__ */ r((e) => {
	switch (e.$type) {
		case "AbnfStringLiteral": return {
			type: "terminal",
			value: e.value
		};
		case "AbnfNumVal": return {
			type: "terminal",
			value: e.value
		};
		case "AbnfRuleName": return {
			type: "nonterminal",
			name: e.name
		};
		case "AbnfGroup": return l(e.element);
		case "AbnfOptionalGroup": return {
			type: "optional",
			element: l(e.element)
		};
		default: throw Error(`Unsupported ABNF primary node: ${e.$type}`);
	}
}, "transformPrimary"), m = /* @__PURE__ */ r((e) => ({
	name: e.name,
	definition: l(e.definition)
}), "transformRule"), h = /* @__PURE__ */ r((e) => {
	s(e, o), e.title && o.setTitle(e.title), e.rules.map((e) => o.addRule(m(e)));
}, "populateDb"), g = {
	parser: {
		parse: /* @__PURE__ */ r((t) => {
			o.clear(), e.debug("[ABNF Parser] Starting Langium parse");
			let r = c.parse(t);
			if (r.lexerErrors.length > 0 || r.parserErrors.length > 0) throw new n(r);
			let i = r.value;
			e.debug("[ABNF Parser] Parsed rules:", i.rules.length), h(i), e.debug("[ABNF Parser] Parse complete");
		}, "parse"),
		parser: { yy: o }
	},
	db: o,
	renderer: a,
	styles: i
};
export { g as diagram };
