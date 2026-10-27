// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { useState as e } from "react";
import { Box as t, Flex as n, Portal as r, Stack as i, Text as a, chakra as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/conversation-browse.tsx
var l = 3, u = 10, d = 4, f = (e, t) => {
	if (t === null) return 0;
	let n = Math.abs(e - t);
	return n >= d ? 0 : (1 + Math.cos(Math.PI * n / d)) / 2;
}, p = (e, t) => {
	if (t === null) return "fg.subtle";
	let n = Math.abs(e - t);
	return n < .5 ? "fg" : n < d ? "fg.muted" : "fg.subtle";
}, m = (e) => {
	let { item: n, position: o } = e;
	return /* @__PURE__ */ s(r, { children: /* @__PURE__ */ s(t, {
		position: "fixed",
		left: `${o.left}px`,
		ml: "2xs",
		top: `${o.top}px`,
		transform: "translateY(-50%)",
		w: "80",
		maxW: "80",
		zIndex: "popover",
		pointerEvents: "none",
		children: /* @__PURE__ */ c(i, {
			gap: "1.5",
			p: "3",
			bg: "bg.elevated",
			borderWidth: "1px",
			borderColor: "border",
			borderRadius: "lg",
			children: [/* @__PURE__ */ s(a, {
				textStyle: "label/S/medium",
				color: "fg",
				lineClamp: 2,
				children: n.message
			}), n.reply ? /* @__PURE__ */ s(a, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				lineClamp: 2,
				children: n.reply
			}) : null]
		})
	}) });
}, h = (r) => {
	let { items: i, onSelect: a, floating: d = !1 } = r, [h, g] = e(null), [_, v] = e(null);
	if (i.length < l) return null;
	let y = (e) => {
		let t = e.currentTarget.getBoundingClientRect(), n = (e.clientY - t.top) / t.height, r = Math.min(i.length - 1, Math.max(0, n * i.length - .5)), a = Math.round(r);
		g(r), v({
			left: t.right,
			top: t.top + (a + .5) / i.length * t.height
		});
	}, b = h === null ? null : Math.round(h), x = b === null ? null : i[b];
	return /* @__PURE__ */ c(t, {
		position: "relative",
		w: "10",
		flexShrink: 0,
		children: [/* @__PURE__ */ s(n, {
			direction: "column",
			align: "flex-start",
			gap: "1.5",
			px: "1.5",
			py: "2",
			w: "10",
			onPointerMove: y,
			onPointerLeave: () => g(null),
			...d ? {
				position: "absolute",
				insetInlineStart: 0,
				top: 0,
				bottom: 0,
				bg: "bg"
			} : {},
			children: i.map((e, t) => /* @__PURE__ */ s(o.button, {
				type: "button",
				h: "2px",
				w: `${u + 16 * f(t, h)}px`,
				bg: p(t, h),
				borderRadius: "1px",
				transition: "width 80ms linear, background-color 80ms linear",
				"aria-label": `Jump to message ${t + 1}`,
				onClick: () => a?.(e.id)
			}, e.id))
		}), x && _ ? /* @__PURE__ */ s(m, {
			item: x,
			position: _
		}) : null]
	});
}, g = [
	{
		id: "1",
		message: "What's left on PS-51?",
		reply: "The input hover border only — one token in the input recipe."
	},
	{
		id: "2",
		message: "Do it and show me the diff.",
		reply: "Done — one line in packages/ui/src/theme/recipes/input.ts."
	},
	{
		id: "3",
		message: "Now migrate the dark tokens too.",
		reply: "Synced the dark neutral scale to the .pen variables."
	},
	{
		id: "4",
		message: "Wire the model menu into the composer.",
		reply: "Moved it into the input toolbar next to attach and send."
	},
	{
		id: "5",
		message: "The workspace selector should live in the hub.",
		reply: "Relocated it to the hub header identity slot."
	},
	{
		id: "6",
		message: "Add the conversation scrubber.",
		reply: "Added the tick rail with a proximity lens and hover cards."
	},
	{
		id: "7",
		message: "Ship it once validation passes."
	}
], _ = {
	title: "Patterns/Chat/Conversation Browse",
	component: h,
	parameters: { layout: "centered" }
}, v = { render: () => /* @__PURE__ */ s(t, {
	h: "360px",
	display: "flex",
	alignItems: "center",
	children: /* @__PURE__ */ s(h, {
		items: g,
		onSelect: (e) => console.log("scroll to", e)
	})
}) }, y = { render: () => /* @__PURE__ */ s(t, {
	w: "10",
	h: "360px",
	display: "flex",
	alignItems: "center",
	overflow: "hidden",
	children: /* @__PURE__ */ s(h, {
		items: g,
		onSelect: (e) => console.log("scroll to", e)
	})
}) }, b = { render: () => /* @__PURE__ */ c(t, {
	position: "relative",
	w: "360px",
	h: "360px",
	bg: "bg",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "lg",
	p: "3",
	children: [/* @__PURE__ */ s(i, {
		gap: "3",
		children: g.map((e) => /* @__PURE__ */ s(a, {
			textStyle: "label/S/regular",
			color: "fg",
			pl: "10",
			children: e.message
		}, e.id))
	}), /* @__PURE__ */ s(t, {
		position: "absolute",
		top: "3",
		bottom: "3",
		left: "3",
		display: "flex",
		alignItems: "center",
		children: /* @__PURE__ */ s(h, {
			items: g,
			floating: !0,
			onSelect: (e) => console.log("scroll to", e)
		})
	})]
}) };
export { y as ClippedContainer, b as Floating, v as Gutter, _ as default };
