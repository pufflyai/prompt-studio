// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./canvas-BXvXw29d.ts";
import { n as i } from "./canvas.examples-CmEVODJP.ts";
import { Box as a, Button as o, Stack as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
// packages/ui/src/components/canvas/canvas-gestures.stories.tsx
var l = {
	title: "Components/Layout/Canvas Gestures",
	component: r,
	tags: ["!manifest"],
	args: {
		zoom: 1,
		onPan: e(),
		onZoom: e(),
		onFit: e()
	}
}, u = e(), d = e(), f = {
	render: (e) => /* @__PURE__ */ c(r, {
		...e,
		h: "600px",
		"aria-label": "Outer canvas",
		children: /* @__PURE__ */ c(a, {
			p: "lg",
			"data-canvas-control": !0,
			children: /* @__PURE__ */ c(r, {
				h: "300px",
				zoom: 1,
				onPan: u,
				onZoom: d,
				"aria-label": "Inner canvas"
			})
		})
	}),
	play: async ({ canvasElement: e, args: r }) => {
		u.mockClear(), d.mockClear();
		let i = t(e).getByRole("region", { name: "Inner canvas" });
		i.dispatchEvent(new WheelEvent("wheel", {
			bubbles: !0,
			cancelable: !0,
			deltaY: 80
		})), await n(u).toHaveBeenCalledOnce(), await n(r.onPan).not.toHaveBeenCalled(), i.dispatchEvent(new WheelEvent("wheel", {
			bubbles: !0,
			cancelable: !0,
			deltaY: 80,
			ctrlKey: !0
		})), await n(d).toHaveBeenCalledOnce(), await n(r.onZoom).not.toHaveBeenCalled();
	}
}, p = {
	render: (e) => /* @__PURE__ */ c(i, { ...e }),
	play: async ({ canvasElement: e, args: t }) => {
		let r = e.querySelector("[aria-label=\"Scrollable preview\"] [data-part=\"viewport\"]");
		await n(r.scrollHeight).toBeGreaterThan(r.clientHeight);
		let i = new WheelEvent("wheel", {
			bubbles: !0,
			cancelable: !0,
			deltaX: 80,
			deltaY: 40
		});
		r.dispatchEvent(i), await n(i.defaultPrevented).toBe(!1), await n(t.onPan).not.toHaveBeenCalled();
	}
}, m = {
	render: (e) => /* @__PURE__ */ c(r, {
		...e,
		h: "400px",
		"aria-label": "Touch canvas",
		children: /* @__PURE__ */ c(o, {
			onClick: e.onFit,
			children: "Touch action"
		})
	}),
	play: async ({ canvasElement: e, args: r }) => {
		let i = t(e).getByRole("region", { name: "Touch canvas" }).querySelector("[data-canvas-background]"), a = (e, t, n) => new Touch({
			identifier: e,
			target: i,
			clientX: t,
			clientY: n
		}), o = (e, t) => i.dispatchEvent(new TouchEvent(e, {
			bubbles: !0,
			cancelable: !0,
			touches: t,
			targetTouches: t
		}));
		o("touchstart", [a(1, 100, 100), a(2, 200, 100)]), o("touchmove", [a(1, 100, 100), a(2, 240, 100)]), await n(r.onZoom).toHaveBeenCalledOnce(), o("touchend", [a(1, 100, 100)]), o("touchmove", [a(1, 130, 120)]), await n(r.onPan).toHaveBeenCalledWith({
			x: 30,
			y: 20
		}), o("touchend", []);
		let s = t(e).getByRole("button", { name: "Touch action" });
		s.dispatchEvent(new PointerEvent("pointerdown", {
			bubbles: !0,
			pointerType: "touch",
			button: 0
		})), s.dispatchEvent(new MouseEvent("click", {
			bubbles: !0,
			cancelable: !0,
			detail: 1
		})), await n(r.onFit).toHaveBeenCalledOnce();
	}
}, h = {
	render: (e) => /* @__PURE__ */ c(s, { children: [
		0,
		-1,
		NaN,
		Infinity
	].map((t, n) => /* @__PURE__ */ c(r, {
		...e,
		h: "32",
		zoom: t,
		"aria-label": `Invalid zoom ${n}`
	}, n)) }),
	play: async ({ canvasElement: e, args: r }) => {
		await n(t(e).getAllByRole("region")).toHaveLength(4), await n(r.onZoom).not.toHaveBeenCalled();
	}
};
export { p as DiagonalPreviewScroll, h as InvalidControlledZoom, f as NestedCanvases, m as PanAfterPinch, l as default };
