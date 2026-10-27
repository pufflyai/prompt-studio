// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { Portal as t, Tooltip as n, useTooltipContext as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
var o = (t) => {
	let { disabled: n } = t, i = r(), a = e.useRef(void 0);
	return e.useLayoutEffect(() => {
		n || (a.current = i.getTriggerProps().onPointerLeave);
	}, [i, n]), e.useLayoutEffect(() => {
		n && a.current?.();
	}, [n]), null;
}, s = e.forwardRef(function(r, s) {
	let { children: c, disabled: l, portalled: u = !0, content: d, contentProps: f, portalRef: p, ids: m, overflowRef: h, ...g } = r, [_, v] = e.useState(!1);
	e.useLayoutEffect(() => {
		let e = h?.current;
		if (!e) return;
		let t = () => v(e.scrollWidth > e.clientWidth);
		t();
		let n = new ResizeObserver(t);
		n.observe(e);
		let r = new MutationObserver(t);
		return r.observe(e, {
			childList: !0,
			characterData: !0,
			subtree: !0
		}), () => {
			n.disconnect(), r.disconnect();
		};
	}, [h]);
	let y = l || ((t) => {
		if (t == null || t === !1) return !0;
		let n = e.Children.toArray(t);
		return n.length === 0 || n.every((e) => typeof e == "string" && e.trim().length === 0);
	})(d);
	if (y && !h) return c;
	let b = !!(y || h && !_), x = c?.props?.id;
	return /* @__PURE__ */ a(n.Root, {
		openDelay: 380,
		closeDelay: 100,
		ids: {
			trigger: x,
			...m
		},
		...g,
		disabled: b,
		open: b && g.open !== void 0 ? !1 : g.open,
		children: [
			/* @__PURE__ */ i(o, { disabled: b }),
			/* @__PURE__ */ i(n.Trigger, {
				asChild: !0,
				children: c
			}),
			/* @__PURE__ */ i(t, {
				disabled: !u,
				container: p,
				children: /* @__PURE__ */ i(n.Positioner, { children: /* @__PURE__ */ i(n.Content, {
					ref: s,
					...f,
					children: d
				}) })
			})
		]
	});
});
export { s as t };
