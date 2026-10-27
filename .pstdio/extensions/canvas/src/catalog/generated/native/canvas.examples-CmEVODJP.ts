// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { n as t, t as n } from "./canvas-BXvXw29d.ts";
import { useLayoutEffect as r, useRef as i, useState as a } from "react";
import { Box as o, Button as s, Dialog as c, Flex as l, Input as u, Popover as d, Portal as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/canvas/canvas.examples.tsx
var _ = () => {
	let [e, t] = a(0);
	return /* @__PURE__ */ g(p, {
		gap: "md",
		p: "md",
		"data-canvas-control": !0,
		children: [
			/* @__PURE__ */ h(m, {
				textStyle: "heading/S",
				children: "Live preview"
			}),
			/* @__PURE__ */ h(u, {
				"aria-label": "Preview draft",
				placeholder: "Edit this draft"
			}),
			/* @__PURE__ */ g(s, {
				onClick: () => t(e + 1),
				children: ["Count ", e]
			}),
			/* @__PURE__ */ g(d.Root, { children: [/* @__PURE__ */ h(d.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ h(s, { children: "Open popover" })
			}), /* @__PURE__ */ h(f, { children: /* @__PURE__ */ h(d.Positioner, { children: /* @__PURE__ */ h(d.Content, { children: /* @__PURE__ */ h(d.Body, { children: /* @__PURE__ */ h(u, {
				"aria-label": "Popover draft",
				placeholder: "Portal input"
			}) }) }) }) })] }),
			/* @__PURE__ */ g(c.Root, { children: [/* @__PURE__ */ h(c.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ h(s, { children: "Open dialog" })
			}), /* @__PURE__ */ g(f, { children: [/* @__PURE__ */ h(c.Backdrop, {}), /* @__PURE__ */ h(c.Positioner, { children: /* @__PURE__ */ g(c.Content, { children: [
				/* @__PURE__ */ h(c.Header, { children: /* @__PURE__ */ h(c.Title, { children: "Preview dialog" }) }),
				/* @__PURE__ */ h(c.Body, { children: /* @__PURE__ */ h(u, {
					"aria-label": "Dialog draft",
					placeholder: "Portal input"
				}) }),
				/* @__PURE__ */ h(c.Footer, { children: /* @__PURE__ */ h(c.ActionTrigger, {
					asChild: !0,
					children: /* @__PURE__ */ h(s, { children: "Close" })
				}) })
			] }) })] })] })
		]
	});
}, v = (s) => {
	let { minZoom: c = .1, maxZoom: l = 4, onPan: u, onZoom: d, onFit: f, onReset: v, onNavigationEnd: y } = s, b = i(null), x = i(null), S = i({
		x: 24,
		y: 24,
		zoom: 1
	}), C = i(0), [w, T] = a(1), E = () => {
		C.current ||= requestAnimationFrame(() => {
			C.current = 0;
			let { x: e, y: t, zoom: n } = S.current;
			x.current && (x.current.style.transform = `translate(${e}px,${t}px) scale(${n})`);
		});
	};
	return r(() => {
		let { x: e, y: t, zoom: n } = S.current;
		return x.current.style.transform = `translate(${e}px,${t}px) scale(${n})`, () => cancelAnimationFrame(C.current);
	}, []), /* @__PURE__ */ h(n, {
		ref: b,
		h: "600px",
		"aria-label": "Live designs canvas",
		zoom: w,
		minZoom: c,
		maxZoom: l,
		onPan: (e) => {
			S.current = {
				...S.current,
				x: S.current.x + e.x,
				y: S.current.y + e.y
			}, E(), u?.(e);
		},
		onZoom: (e) => {
			S.current = t(S.current, e, {
				minZoom: c,
				maxZoom: l
			}), T(S.current.zoom), E(), d?.(e);
		},
		onFit: () => {
			let e = Math.max(c, Math.min((b.current.clientWidth - 48) / 800, (b.current.clientHeight - 48) / 380, l));
			S.current = {
				x: 24,
				y: 24,
				zoom: e
			}, T(e), E(), f?.();
		},
		onReset: () => {
			S.current = {
				x: 24,
				y: 24,
				zoom: 1
			}, T(1), E(), v?.();
		},
		onNavigationEnd: y,
		children: /* @__PURE__ */ g(o, {
			ref: x,
			position: "absolute",
			top: "0",
			left: "0",
			transformOrigin: "0 0",
			"data-example-stage": !0,
			children: [/* @__PURE__ */ h(o, {
				position: "absolute",
				top: "0",
				left: "0",
				w: "360px",
				h: "380px",
				bg: "bg",
				borderWidth: "1px",
				borderColor: "border",
				borderRadius: "xs",
				"data-canvas-control": !0,
				children: /* @__PURE__ */ h(_, {})
			}), /* @__PURE__ */ h(o, {
				position: "absolute",
				top: "0",
				left: "440px",
				w: "360px",
				h: "380px",
				bg: "bg",
				borderWidth: "1px",
				borderColor: "border",
				borderRadius: "xs",
				"data-canvas-control": !0,
				children: /* @__PURE__ */ h(e, {
					h: "full",
					"aria-label": "Scrollable preview",
					children: /* @__PURE__ */ h(p, {
						p: "md",
						gap: "md",
						children: Array.from({ length: 20 }, (e, t) => /* @__PURE__ */ g(m, {
							textStyle: "paragraph/S/regular",
							children: ["Preview row ", t + 1]
						}, t))
					})
				})
			})]
		})
	});
}, y = (e) => {
	let { onScroll: c } = e, d = i(null), f = i(void 0), _ = i(1), [{ zoom: v }, y] = a({ zoom: 1 }), [b, x] = a();
	return r(() => {
		let e = f.current;
		e && d.current?.scrollTo({
			left: -e.x,
			top: -e.y
		}), f.current = void 0;
	}), /* @__PURE__ */ h(l, {
		h: "600px",
		direction: "column",
		minW: "0",
		children: /* @__PURE__ */ h(n, {
			ref: d,
			flex: "1",
			variant: "pan",
			"aria-label": "Timeline canvas",
			zoom: v,
			onPan: (e) => {
				f.current ? f.current = {
					...f.current,
					x: f.current.x + e.x,
					y: f.current.y + e.y
				} : d.current?.scrollBy({
					left: -e.x,
					top: -e.y
				});
			},
			onZoom: (e) => {
				let n = f.current ?? {
					x: -d.current.scrollLeft,
					y: -d.current.scrollTop,
					zoom: _.current
				}, r = t(n, e);
				f.current = r, _.current = r.zoom, y({ zoom: r.zoom });
			},
			onScroll: c,
			children: /* @__PURE__ */ g(o, {
				position: "relative",
				w: "2000px",
				h: "1600px",
				css: { zoom: v },
				"data-example-scroll-content": !0,
				children: [/* @__PURE__ */ g(l, {
					position: "sticky",
					top: "0",
					left: "0",
					zIndex: "1",
					gap: "md",
					p: "md",
					bg: "bg",
					borderBottomWidth: "1px",
					borderColor: "border",
					"data-canvas-control": !0,
					children: [/* @__PURE__ */ h(m, {
						textStyle: "heading/S",
						children: "Timeline tracks"
					}), /* @__PURE__ */ h(u, {
						size: "xs",
						"aria-label": "Track name",
						defaultValue: "Design",
						w: "xs"
					})]
				}), /* @__PURE__ */ h(p, {
					gap: "lg",
					p: "lg",
					w: "lg",
					children: Array.from({ length: 8 }, (e, t) => /* @__PURE__ */ g(s, {
						"data-canvas-control": !0,
						onClick: () => x(t),
						"aria-pressed": b === t,
						children: ["Ticket ", t + 1]
					}, t))
				})]
			})
		})
	});
}, b = () => {
	let [e, t] = a(!1), [r, i] = a(1);
	return /* @__PURE__ */ h(n, {
		"aria-label": "Flow canvas",
		zoom: r,
		onPan: () => {},
		onZoom: (e) => i((t) => t * e.factor),
		h: "400px",
		children: /* @__PURE__ */ g(p, {
			gap: "md",
			p: "md",
			maxW: "sm",
			css: { zoom: r },
			"data-canvas-control": !0,
			children: [/* @__PURE__ */ h(u, {
				"aria-label": "Flow draft",
				placeholder: "Normal-flow content"
			}), /* @__PURE__ */ h(s, {
				onClick: () => t(!0),
				children: e ? "Clicked" : "Click me"
			})]
		})
	});
};
export { v as n, y as r, b as t };
