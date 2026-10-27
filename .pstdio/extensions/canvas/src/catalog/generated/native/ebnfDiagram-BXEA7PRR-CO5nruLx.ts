// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./src-Bie5yc-F.ts";
import { f as t, t as n } from "./mermaid-parser.core-CQOZNFIk.ts";
import { n as r } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import "./chunk-I66GZJ75-3HfQzheA.ts";
import "./mermaid-renderer-DxExU8WG.ts";
import { n as i, r as a, t as o } from "./chunk-6Q2QTUOP-pxLrNWXQ.ts";
import { t as s } from "./chunk-JWPE2WC7-nGp8ldvS.ts";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/ebnfDiagram-BXEA7PRR.mjs
var c = t().RailroadEbnf.parser.LangiumParser, l = /* @__PURE__ */ r((e) => {
	let t = e.alternatives.map(u);
	return t.length === 1 ? t[0] : {
		type: "choice",
		alternatives: t
	};
}, "transformChoice"), u = /* @__PURE__ */ r((e) => {
	let t = e.elements.map(p);
	return t.length === 1 ? t[0] : {
		type: "sequence",
		elements: t
	};
}, "transformSequence"), d = /* @__PURE__ */ r((e) => {
	switch (e.$type) {
		case "EbnfTerminal": return {
			type: "terminal",
			value: e.value
		};
		case "EbnfNonTerminal": return {
			type: "nonterminal",
			name: e.name
		};
		case "EbnfSpecial": return {
			type: "special",
			text: e.text
		};
		case "EbnfGroup": return l(e.element);
		case "EbnfOptional": return {
			type: "optional",
			element: l(e.element)
		};
		case "EbnfRepetition": return {
			type: "repetition",
			element: l(e.element),
			min: 0,
			max: Infinity
		};
		default: throw Error(`Unsupported EBNF primary node: ${e.$type}`);
	}
}, "transformPrimary"), f = /* @__PURE__ */ r((e, t) => {
	switch (t.$type) {
		case "EbnfOptionalPostfix": return {
			type: "optional",
			element: e
		};
		case "EbnfZeroOrMorePostfix": return {
			type: "repetition",
			element: e,
			min: 0,
			max: Infinity
		};
		case "EbnfOneOrMorePostfix": return {
			type: "repetition",
			element: e,
			min: 1,
			max: Infinity
		};
		case "EbnfExceptionPostfix": return {
			type: "sequence",
			elements: [
				e,
				{
					type: "terminal",
					value: "-"
				},
				d(t.except)
			]
		};
		default: throw Error(`Unsupported EBNF postfix node: ${t.$type}`);
	}
}, "transformPostfix"), p = /* @__PURE__ */ r((e) => e.postfixes.reduce((e, t) => f(e, t), d(e.base)), "transformTerm"), m = /* @__PURE__ */ r((e) => ({
	name: e.name,
	definition: l(e.definition)
}), "transformRule"), h = /* @__PURE__ */ r((e) => {
	s(e, o), e.title && o.setTitle(e.title), e.rules.map((e) => o.addRule(m(e)));
}, "populateDb"), g = {
	parser: {
		parse: /* @__PURE__ */ r((t) => {
			o.clear(), e.debug("[EBNF Parser] Starting Langium parse");
			let r = c.parse(t);
			if (r.lexerErrors.length > 0 || r.parserErrors.length > 0) throw new n(r);
			let i = r.value;
			e.debug("[EBNF Parser] Parsed rules:", i.rules.length), h(i), e.debug("[EBNF Parser] Parse complete");
		}, "parse"),
		parser: { yy: o }
	},
	db: o,
	renderer: a,
	styles: i
};
export { g as diagram };
