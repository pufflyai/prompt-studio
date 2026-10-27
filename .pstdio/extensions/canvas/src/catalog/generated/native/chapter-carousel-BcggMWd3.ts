// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./page-scroll-CScB-LpO.ts";
import { useEffect as t, useId as n, useRef as r, useState as i } from "react";
import { Box as a, Tabs as o, defineSlotRecipe as s, useSlotRecipe as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// clients/landing-page/src/hooks/use-chapter-playback.ts
var d = 8e3, f = (e, n, a) => {
	let [o, s] = i(!1), [c, l] = i(!1), [u, f] = i(!1), p = r(a);
	p.current = a;
	let m = !o && !c && !u;
	return t(() => {
		let e = window.matchMedia("(prefers-reduced-motion: reduce)"), t = () => f(e.matches);
		return t(), e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []), t(() => {
		if (!m || !n) return;
		let t = !1, r, i = () => {
			clearTimeout(r), t && document.visibilityState === "visible" && (r = setTimeout(() => p.current(), d));
		}, a = new IntersectionObserver(([e]) => {
			t = e.isIntersecting, i();
		});
		return a.observe(e.current), document.addEventListener("visibilitychange", i), () => {
			clearTimeout(r), a.disconnect(), document.removeEventListener("visibilitychange", i);
		};
	}, [
		m,
		n,
		e
	]), {
		playing: m,
		setHovered: s,
		setFocused: l
	};
}, p = s({
	slots: [
		"root",
		"tabs",
		"header",
		"list",
		"trigger",
		"slide"
	],
	base: {
		root: {
			height: "full",
			minHeight: 0,
			minWidth: 0,
			overflow: "hidden"
		},
		tabs: {
			display: "grid",
			_horizontal: { display: "grid" },
			gridTemplateRows: "auto minmax(0, 1fr)",
			height: "full",
			minHeight: 0,
			gap: 0
		},
		header: {
			display: "flex",
			alignItems: "center",
			gap: "md",
			px: {
				base: "sm",
				md: "xl"
			},
			py: "xs",
			borderBottomWidth: "1px",
			borderColor: "border.subtle",
			flexShrink: 0,
			minWidth: 0
		},
		list: {
			flex: 1,
			minWidth: 0,
			minHeight: 0,
			overflowX: "auto",
			flexWrap: "nowrap",
			border: "none"
		},
		trigger: {
			flexShrink: 0,
			whiteSpace: "nowrap",
			gap: "sm"
		},
		slide: {
			minHeight: 0,
			minWidth: 0,
			p: 0,
			overflow: "hidden",
			touchAction: "pan-y",
			focusVisibleRing: "inside"
		}
	}
}), m = (i) => {
	let { label: s, chapters: d, value: m, onChange: h } = i, g = c({ recipe: p })({}), _ = r(null), v = n(), y = d.findIndex((e) => e.id === m), b = d[y], x = r(null), S = (e, t = !1) => {
		e !== m && h(e, t);
	}, C = f(_, m, () => S(d[(y + 1) % d.length].id, !0));
	return t(() => {
		_.current?.querySelectorAll("[role=\"tab\"]")[y]?.scrollIntoView({
			block: "nearest",
			inline: "nearest"
		});
	}, [y]), /* @__PURE__ */ l(a, {
		ref: _,
		css: g.root,
		role: "region",
		"aria-roledescription": "carousel",
		"aria-label": s,
		"data-playing": C.playing,
		onPointerEnter: (e) => {
			e.pointerType === "mouse" && C.setHovered(!0);
		},
		onPointerLeave: () => C.setHovered(!1),
		onFocusCapture: () => C.setFocused(!0),
		onBlurCapture: (e) => {
			e.currentTarget.contains(e.relatedTarget) || C.setFocused(!1);
		},
		children: /* @__PURE__ */ u(o.Root, {
			css: g.tabs,
			size: "sm",
			value: m,
			onValueChange: ({ value: e }) => S(e),
			navigate: () => void 0,
			ids: {
				trigger: (e) => `${v}-${e}-tab`,
				content: (e) => `${v}-${e}-panel`
			},
			children: [/* @__PURE__ */ l(a, {
				css: g.header,
				children: /* @__PURE__ */ l(o.List, {
					css: g.list,
					"aria-label": `${s} chapters`,
					children: d.map((e) => /* @__PURE__ */ l(o.Trigger, {
						value: e.id,
						css: g.trigger,
						asChild: !!e.href,
						children: e.href ? /* @__PURE__ */ l("a", {
							href: e.href,
							onClick: (t) => {
								t.button !== 0 || t.metaKey || t.ctrlKey || t.shiftKey || t.altKey || (t.preventDefault(), S(e.id));
							},
							children: e.label
						}) : e.label
					}, e.id))
				})
			}), /* @__PURE__ */ l(a, {
				role: "tabpanel",
				tabIndex: 0,
				id: `${v}-${b.id}-panel`,
				"aria-labelledby": `${v}-${b.id}-tab`,
				css: g.slide,
				"aria-roledescription": "slide",
				onTouchStart: (e) => {
					x.current = null;
					let t = e.target;
					e.touches.length !== 1 || t.closest("button, a, input, textarea, select, [role=\"slider\"]") || (x.current = {
						x: e.touches[0].clientX,
						y: e.touches[0].clientY
					});
				},
				onTouchCancel: () => {
					x.current = null;
				},
				onTouchEnd: (e) => {
					let t = x.current;
					if (x.current = null, !t) return;
					let n = e.changedTouches[0].clientX - t.x, r = e.changedTouches[0].clientY - t.y;
					if (Math.abs(n) < 60 || Math.abs(n) < Math.abs(r) * 1.5) return;
					let i = Math.max(0, Math.min(d.length - 1, y + (n < 0 ? 1 : -1)));
					i !== y && S(d[i].id);
				},
				children: /* @__PURE__ */ l(e, { children: b.content })
			}, b.id)]
		})
	});
};
export { m as t };
