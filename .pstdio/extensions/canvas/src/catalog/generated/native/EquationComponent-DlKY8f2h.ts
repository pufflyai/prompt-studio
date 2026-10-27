// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./katex-DhNjlQSb.ts";
import { t } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { Component as n, useEffect as r, useRef as i, useState as a } from "react";
import { Fragment as o, jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/shared/plugins/EquationPlugin/KatexRenderer.tsx
function l({ equation: t, inline: n }) {
	let a = i(null);
	return r(() => {
		let r = a.current;
		r !== null && e.render(t, r, {
			displayMode: !n,
			errorColor: "#cc0000",
			output: "html",
			strict: "warn",
			throwOnError: !1,
			trust: !1
		});
	}, [t, n]), /* @__PURE__ */ c(o, { children: [
		/* @__PURE__ */ s("img", {
			src: "#",
			alt: ""
		}),
		/* @__PURE__ */ s("span", { ref: a }),
		/* @__PURE__ */ s("img", {
			src: "#",
			alt: ""
		})
	] });
}
// packages/ui/src/components/rich-text/shared/plugins/EquationPlugin/EquationComponent.tsx
var u = class extends n {
	state = { hasError: !1 };
	static getDerivedStateFromError() {
		return { hasError: !0 };
	}
	componentDidCatch(e) {
		this.props.onError(e);
	}
	render() {
		return this.state.hasError ? null : this.props.children;
	}
};
function d({ equation: e, inline: n }) {
	let [r] = t(), [i, o] = a(e);
	return /* @__PURE__ */ s(u, {
		onError: (e) => r._onError(e),
		children: /* @__PURE__ */ s(l, {
			equation: i,
			inline: n
		})
	});
}
export { d as default };
