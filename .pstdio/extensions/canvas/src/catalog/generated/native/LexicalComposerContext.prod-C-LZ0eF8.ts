// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e, useContext as t } from "react";
// node_modules/.bun/@lexical+react@0.40.0+60fa178158e73238/node_modules/@lexical/react/LexicalComposerContext.prod.mjs
var n = e(null);
function r(e, t) {
	let n = null;
	return e != null && (n = e[1]), { getTheme: function() {
		return t ?? (n == null ? null : n.getTheme());
	} };
}
function i() {
	let e = t(n);
	return e ?? function(e, ...t) {
		let n = new URL("https://lexical.dev/docs/error"), r = new URLSearchParams();
		r.append("code", e);
		for (let e of t) r.append("v", e);
		throw n.search = r.toString(), Error(`Minified Lexical error #${e}; visit ${n.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
	}(8), e;
}
export { n, r, i as t };
