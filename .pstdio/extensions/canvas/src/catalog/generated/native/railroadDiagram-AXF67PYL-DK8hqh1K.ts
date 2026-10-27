// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./src-Bie5yc-F.ts";
import { g as t, t as n } from "./mermaid-parser.core-CQOZNFIk.ts";
import { n as r } from "./chunk-Y2CYZVJY-DqH9smpi.ts";
import "./chunk-I66GZJ75-3HfQzheA.ts";
import "./mermaid-renderer-DxExU8WG.ts";
import { n as i, r as a, t as o } from "./chunk-6Q2QTUOP-pxLrNWXQ.ts";
import { t as s } from "./chunk-JWPE2WC7-nGp8ldvS.ts";
// node_modules/.bun/mermaid@11.16.1/node_modules/mermaid/dist/chunks/mermaid.core/railroadDiagram-AXF67PYL.mjs
var c = t().Railroad.parser.LangiumParser, l = /* @__PURE__ */ r((e) => {
	switch (e.$type) {
		case "RailroadTerminalExpr": return {
			type: "terminal",
			value: e.value
		};
		case "RailroadNonTerminalExpr": return {
			type: "nonterminal",
			name: e.name
		};
		case "RailroadSpecialExpr": return {
			type: "special",
			text: e.text
		};
		case "RailroadSequenceExpr": {
			let t = e.elements.map(l);
			return t.length === 1 ? t[0] : {
				type: "sequence",
				elements: t
			};
		}
		case "RailroadChoiceExpr": {
			let t = e.alternatives.map(l);
			return t.length === 1 ? t[0] : {
				type: "choice",
				alternatives: t
			};
		}
		case "RailroadOptionalExpr": return {
			type: "optional",
			element: l(e.element)
		};
		case "RailroadOneOrMoreExpr": return {
			type: "repetition",
			element: l(e.element),
			min: 1,
			max: Infinity
		};
		case "RailroadZeroOrMoreExpr": return {
			type: "repetition",
			element: l(e.element),
			min: 0,
			max: Infinity
		};
		default: throw Error(`Unsupported railroad expression: ${e.$type}`);
	}
}, "transformExpression"), u = /* @__PURE__ */ r((e) => ({
	name: e.name,
	definition: l(e.definition)
}), "transformRule"), d = /* @__PURE__ */ r((e) => {
	s(e, o), e.title && o.setTitle(e.title), e.rules.map((e) => o.addRule(u(e)));
}, "populateDb"), f = {
	parser: {
		parse: /* @__PURE__ */ r((t) => {
			o.clear(), e.debug("[Railroad Parser] Starting Langium parse");
			let r = c.parse(t);
			if (r.lexerErrors.length > 0 || r.parserErrors.length > 0) throw new n(r);
			let i = r.value;
			e.debug("[Railroad Parser] Parsed rules:", i.rules.length), d(i), e.debug("[Railroad Parser] Parse complete");
		}, "parse"),
		parser: { yy: o }
	},
	db: o,
	renderer: a,
	styles: i
};
export { f as diagram };
