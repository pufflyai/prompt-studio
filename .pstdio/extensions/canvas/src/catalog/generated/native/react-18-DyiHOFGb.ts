// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import * as t from "react-dom/client";
// node_modules/.bun/@storybook+react-dom-shim@10.6.0+40f4eef57c5b83c1/node_modules/@storybook/react-dom-shim/dist/react-18.js
var n = /* @__PURE__ */ new Map();
function r() {
	return globalThis.IS_REACT_ACT_ENVIRONMENT;
}
var i = ({ callback: t, children: n }) => {
	let r = e.useRef();
	return e.useLayoutEffect(() => {
		r.current !== t && (r.current = t, t());
	}, [t]), n;
};
typeof Promise.withResolvers > "u" && (Promise.withResolvers = () => {
	let e = null, t = null;
	return {
		promise: new Promise((n, r) => {
			e = n, t = r;
		}),
		resolve: e,
		reject: t
	};
});
var a = async (t, n, a) => {
	let o = await s(n, a);
	if (r()) {
		o.render(t);
		return;
	}
	let { promise: c, resolve: l } = Promise.withResolvers();
	return o.render(e.createElement(i, { callback: l }, t)), c;
}, o = (e, t) => {
	let r = n.get(e);
	r && (r.unmount(), n.delete(e));
}, s = async (e, r) => {
	let i = n.get(e);
	return i || (i = t.createRoot(e, r), n.set(e, i)), i;
};
export { a as renderElement, o as unmountElement };
