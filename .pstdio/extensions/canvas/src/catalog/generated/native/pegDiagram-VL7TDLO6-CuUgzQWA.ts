// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./src-Bie5yc-F.ts";
import { t, u as n } from "./mermaid-parser.core-CQOZNFIk.ts";
import { n as r } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import "./chunk-I66GZJ75-3HfQzheA.ts";
import "./mermaid-renderer-DxExU8WG.ts";
import { n as i, r as a, t as o } from "./chunk-6Q2QTUOP-pxLrNWXQ.ts";
import { t as s } from "./chunk-JWPE2WC7-nGp8ldvS.ts";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/pegDiagram-VL7TDLO6.mjs
var c = n().RailroadPeg.parser.LangiumParser, l = /* @__PURE__ */ r((e) => {
	let t = e.alternatives.map(u);
	return t.length === 1 ? t[0] : {
		type: "choice",
		alternatives: t
	};
}, "transformOrderedChoice"), u = /* @__PURE__ */ r((e) => {
	let t = e.elements.map(d);
	return t.length === 1 ? t[0] : {
		type: "sequence",
		elements: t
	};
}, "transformSequence"), d = /* @__PURE__ */ r((e) => {
	let t = p(e.suffix);
	return e.operator ? {
		type: "special",
		text: e.operator === "&" ? `&${f(t)}` : `!${f(t)}`
	} : t;
}, "transformPrefix"), f = /* @__PURE__ */ r((e) => {
	switch (e.type) {
		case "terminal": return `"${e.value}"`;
		case "nonterminal": return e.name;
		case "special": return e.text;
		default: return "(...)";
	}
}, "nodeToLabel"), p = /* @__PURE__ */ r((e) => {
	let t = m(e.primary);
	if (!e.operator) return t;
	switch (e.operator) {
		case "?": return {
			type: "optional",
			element: t
		};
		case "*": return {
			type: "repetition",
			element: t,
			min: 0,
			max: Infinity
		};
		case "+": return {
			type: "repetition",
			element: t,
			min: 1,
			max: Infinity
		};
		default: throw Error(`Unsupported PEG suffix operator: ${e.operator}`);
	}
}, "transformSuffix"), m = /* @__PURE__ */ r((e) => {
	switch (e.$type) {
		case "PegLiteral": return {
			type: "terminal",
			value: e.value
		};
		case "PegIdentifier": return {
			type: "nonterminal",
			name: e.name
		};
		case "PegGroup": return l(e.element);
		case "PegAny": return {
			type: "special",
			text: e.dot
		};
		default: throw Error(`Unsupported PEG primary node: ${e.$type}`);
	}
}, "transformPrimary"), h = /* @__PURE__ */ r((e) => ({
	name: e.name,
	definition: l(e.definition)
}), "transformRule"), g = /* @__PURE__ */ r((e) => {
	s(e, o), e.title && o.setTitle(e.title), e.rules.map((e) => o.addRule(h(e)));
}, "populateDb"), _ = {
	parser: {
		parse: /* @__PURE__ */ r((n) => {
			o.clear(), e.debug("[PEG Parser] Starting Langium parse");
			let r = c.parse(n);
			if (r.lexerErrors.length > 0 || r.parserErrors.length > 0) throw new t(r);
			let i = r.value;
			e.debug("[PEG Parser] Parsed rules:", i.rules.length), g(i), e.debug("[PEG Parser] Parse complete");
		}, "parse"),
		parser: { yy: o }
	},
	db: o,
	renderer: a,
	styles: i
};
export { _ as diagram };
