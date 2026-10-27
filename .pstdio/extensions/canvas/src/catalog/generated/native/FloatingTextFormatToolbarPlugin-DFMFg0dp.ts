// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, o as t } from "./lucide-react-CiGXWUCb.ts";
import { x as n } from "./zap-Dajcy3HI.ts";
import { t as r } from "./check-Bgh538vW.ts";
import { t as i } from "./copy-COTDVt4R.ts";
import { n as a } from "./move-BF9Hr353.ts";
import { n as o } from "./ticket-CH4ueYVY.ts";
import { a as s } from "./square-split-horizontal-D8KwXGQS.ts";
import { t as c } from "./tooltip-BweQW627.ts";
import { J as l, K as u, U as d, X as f, et as p, q as m } from "./list-marker-width-plugin-q77pywDH.ts";
import { G as h, Ln as g, Lt as _, Nn as v, On as y, Sn as b, W as x, a as S, bn as C, c as w, g as T, h as E, jn as D, jt as O, l as k, m as A, qt as j, zn as M } from "./rich-text-theme-C7PhYVHR.ts";
import { t as N } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { useEffect as P, useRef as F, useState as I } from "react";
import { Box as L, IconButton as R, Stack as z, Text as B } from "@chakra-ui/react";
import { jsx as V, jsxs as H } from "react/jsx-runtime";
import { createPortal as U } from "react-dom";
// packages/ui/src/components/rich-text/shared/plugins/CodePlugin/CodeBlockActionsPlugin.tsx
function W(e) {
	let t = b();
	if (!O(t)) return null;
	let n = t.anchor.getNode(), r = d(n) ? n : j(n, (e) => d(e));
	if (!d(r)) return null;
	let i = e.getElementByKey(r.getKey());
	return i instanceof HTMLElement ? i : null;
}
function G(e) {
	return e instanceof HTMLElement ? e.closest(".rich-text__code") : null;
}
function K(e, t) {
	let n = e.getBoundingClientRect(), r = t.getBoundingClientRect();
	return {
		top: r.top - n.top + 6,
		left: r.right - n.left - 30
	};
}
function q({ anchorElem: e }) {
	let [t] = N(), [n, a] = I(null), [o, s] = I(!1), l = F(null);
	if (P(() => () => {
		l.current !== null && window.clearTimeout(l.current);
	}, []), P(() => {
		let e = t.getRootElement();
		if (!e) return;
		let n = (e) => {
			let t = G(e.target);
			a(t instanceof HTMLElement ? t : null);
		}, r = () => {
			t.getEditorState().read(() => {
				let e = W(t);
				a(e);
			});
		};
		return e.addEventListener("pointermove", n), e.addEventListener("pointerleave", r), () => {
			e.removeEventListener("pointermove", n), e.removeEventListener("pointerleave", r);
		};
	}, [t]), P(() => _(t.registerUpdateListener(({ editorState: e }) => {
		e.read(() => {
			let e = W(t);
			e && a(e);
		});
	}), t.registerCommand(M, () => (t.getEditorState().read(() => {
		let e = W(t);
		a(e || ((e) => e?.matches(":hover") ? e : null));
	}), !1), 4)), [t]), !e || !n) return null;
	let u = K(e, n), d = {
		position: "absolute",
		top: u.top,
		left: u.left
	};
	return U(/* @__PURE__ */ V("div", {
		className: "code-block-actions",
		style: d,
		children: /* @__PURE__ */ V(c, {
			content: o ? "Copied" : "Copy code",
			children: /* @__PURE__ */ V(R, {
				"aria-label": o ? "Copied" : "Copy code",
				variant: "subtle",
				size: "xs",
				onClick: async () => {
					let e = n.textContent ?? "";
					try {
						await navigator.clipboard.writeText(e), s(!0), l.current !== null && window.clearTimeout(l.current), l.current = window.setTimeout(() => {
							s(!1);
						}, 1200);
					} catch {
						s(!1);
					}
				},
				children: V(o ? r : i, { size: 14 })
			})
		})
	}), e);
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/commands.ts
var J = D("TOGGLE_LINK_EDIT_MODE_COMMAND");
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/utils/getSelectedNode.ts
function Y(e) {
	let t = e.anchor, n = e.focus, r = e.anchor.getNode(), i = e.focus.getNode();
	return r === i ? r : e.isBackward() ? h(n) ? r : i : h(t) ? r : i;
}
// packages/ui/src/components/rich-text/shared/plugins/LinkEditorPlugin/utils/setFloatingElemPos.ts
var X = 10, Z = 5;
function Q(e, t, n, r = X, i = Z, a = "legacy", o = "anchor") {
	let s = n.parentElement;
	if (e === null || !s) {
		t.style.opacity = "0", t.style.transform = "translate(-10000px, -10000px)";
		return;
	}
	let c = t.getBoundingClientRect(), l = n.getBoundingClientRect(), u = o === "viewport" ? new DOMRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight) : s.getBoundingClientRect(), d = a === "above" ? e.top - c.height - r : e.top - r, f = e.left - i;
	d < u.top && (d = a === "above" ? e.bottom + r : d + c.height + e.height + r * 2), f + c.width > u.right && (f = u.right - c.width - i), d + c.height > u.bottom && (d = e.top - c.height - Math.abs(r)), o === "anchor" && (d -= l.top, f -= l.left), t.style.opacity = "1", t.style.transform = `translate(${f}px, ${d}px)`;
}
// packages/ui/src/components/rich-text/shared/plugins/FloatingTextFormatToolbarPlugin/floating-toolbar-buttons.tsx
function $() {
	return /* @__PURE__ */ V("span", { style: {
		display: "inline-flex",
		height: "1rem",
		margin: "0 0.25rem",
		borderLeft: "1px solid var(--chakra-colors-border-subtle)"
	} });
}
function ee(r) {
	let { editor: i, blockType: l, isBold: u, isItalic: d, isUnderline: f, isCode: p, isLink: m, formatHeading: h, formatList: g, formatQuote: _, insertLink: v } = r;
	return /* @__PURE__ */ H(z, {
		direction: "row",
		gap: "0.5",
		alignItems: "center",
		children: [
			/* @__PURE__ */ V(c, {
				content: "Bold",
				children: /* @__PURE__ */ V(R, {
					"data-active": u || void 0,
					onClick: () => i.dispatchCommand(y, "bold"),
					variant: "ghost",
					"aria-label": "Bold",
					size: "xs",
					children: /* @__PURE__ */ V(B, {
						fontWeight: "bold",
						fontSize: ".75rem",
						children: "B"
					})
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Italic",
				children: /* @__PURE__ */ V(R, {
					"data-active": d || void 0,
					onClick: () => i.dispatchCommand(y, "italic"),
					variant: "ghost",
					"aria-label": "Italic",
					size: "xs",
					children: /* @__PURE__ */ V(B, {
						fontStyle: "italic",
						fontSize: ".75rem",
						children: "I"
					})
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Underline",
				children: /* @__PURE__ */ V(R, {
					"data-active": f || void 0,
					onClick: () => i.dispatchCommand(y, "underline"),
					variant: "ghost",
					"aria-label": "Underline",
					size: "xs",
					children: /* @__PURE__ */ V(B, {
						textDecoration: "underline",
						fontSize: ".75rem",
						children: "U"
					})
				})
			}),
			/* @__PURE__ */ V($, {}),
			/* @__PURE__ */ V(c, {
				content: "Heading 1",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "h1" || void 0,
					variant: "ghost",
					"aria-label": "Heading 1",
					size: "xs",
					onClick: () => h("h1"),
					children: /* @__PURE__ */ V(B, {
						fontWeight: "thin",
						fontSize: ".8rem",
						children: "H1"
					})
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Heading 2",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "h2" || void 0,
					variant: "ghost",
					"aria-label": "Heading 2",
					size: "xs",
					onClick: () => h("h2"),
					children: /* @__PURE__ */ V(B, {
						fontWeight: "thin",
						fontSize: ".8rem",
						children: "H2"
					})
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Heading 3",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "h3" || void 0,
					variant: "ghost",
					"aria-label": "Heading 3",
					size: "xs",
					onClick: () => h("h3"),
					children: /* @__PURE__ */ V(B, {
						fontWeight: "thin",
						fontSize: ".8rem",
						children: "H3"
					})
				})
			}),
			/* @__PURE__ */ V($, {}),
			/* @__PURE__ */ V(c, {
				content: "Inline Code",
				children: /* @__PURE__ */ V(R, {
					"data-active": p || void 0,
					onClick: () => i.dispatchCommand(y, "code"),
					variant: "ghost",
					"aria-label": "Inline Code",
					size: "xs",
					children: /* @__PURE__ */ V(n, { size: 14 })
				})
			}),
			/* @__PURE__ */ V(c, {
				content: m ? "Remove Link" : "Insert Link",
				children: /* @__PURE__ */ V(R, {
					"data-active": m || void 0,
					variant: "ghost",
					"aria-label": m ? "Remove Link" : "Insert Link",
					size: "xs",
					onClick: v,
					children: /* @__PURE__ */ V(o, { size: 14 })
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Quote",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "quote" || void 0,
					variant: "ghost",
					"aria-label": "Quote",
					size: "xs",
					onClick: _,
					children: /* @__PURE__ */ V(e, { size: 14 })
				})
			}),
			/* @__PURE__ */ V($, {}),
			/* @__PURE__ */ V(c, {
				content: "Bulleted List",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "bullet" || void 0,
					variant: "ghost",
					"aria-label": "Bulleted List",
					size: "xs",
					onClick: () => g("bullet"),
					children: /* @__PURE__ */ V(s, { size: 14 })
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Numbered List",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "number" || void 0,
					variant: "ghost",
					"aria-label": "Numbered List",
					size: "xs",
					onClick: () => g("number"),
					children: /* @__PURE__ */ V(t, { size: 14 })
				})
			}),
			/* @__PURE__ */ V(c, {
				content: "Check List",
				children: /* @__PURE__ */ V(R, {
					"data-active": l === "check" || void 0,
					variant: "ghost",
					"aria-label": "Check List",
					size: "xs",
					onClick: () => g("check"),
					children: /* @__PURE__ */ V(a, { size: 14 })
				})
			})
		]
	});
}
// packages/ui/src/components/rich-text/shared/plugins/FloatingTextFormatToolbarPlugin/resolve-block-type.ts
var te = {
	bullet: "Bulleted List",
	check: "Check List",
	code: "Code Block",
	h1: "Heading 1",
	h2: "Heading 2",
	h3: "Heading 3",
	h4: "Heading 4",
	h5: "Heading 5",
	h6: "Heading 6",
	number: "Numbered List",
	paragraph: "Normal",
	quote: "Quote"
}, ne = (e) => e in te ? e : null, re = (e) => (e.getKey() === "root" ? e : j(e, (e) => {
	let t = e.getParent();
	return t !== null && g(t);
})) ?? e.getTopLevelElementOrThrow(), ie = (e) => {
	let t = re(e);
	if (m(t)) return t.getListType();
	let n = j(e, (e) => m(e));
	return n !== null && m(n) ? n.getListType() : ne(S(t) ? t.getTag() : t.getType());
};
// packages/ui/src/components/rich-text/shared/plugins/FloatingTextFormatToolbarPlugin/should-show-floating-toolbar.ts
function ae(e) {
	let { hasSelection: t, isRangeSelection: n, isCollapsed: r, hasNativeSelection: i, hasNativeRange: a, isAnchorInsideEditor: o, isEditorEditable: s, isPointerSelecting: c } = e;
	return t && n && !r && i && a && o && s && !c;
}
// packages/ui/src/components/rich-text/shared/plugins/FloatingTextFormatToolbarPlugin/FloatingTextFormatToolbarPlugin.tsx
var oe = -4;
function se({ editor: e, anchorElem: t, isToolbarActive: n, setIsToolbarActive: r }) {
	let i = F(null), [a, o] = I("paragraph"), [s, c] = I(!1), [d, m] = I(!1), [h, g] = I(!1), [y, S] = I(!1), [D, N] = I(!1), R = F(!1), z = F(() => void 0), B = (t) => {
		e.update(() => {
			let e = b();
			O(e) && (a === t ? x(e, C) : x(e, () => w(t)));
		});
	}, H = (t) => {
		if (a === t) {
			e.dispatchCommand(f, void 0);
			return;
		}
		let n = {
			bullet: u,
			number: p,
			check: l
		}[t];
		e.dispatchCommand(n, void 0);
	}, U = () => {
		e.update(() => {
			let e = b();
			O(e) && (a === "quote" ? x(e, C) : x(e, k));
		});
	}, W = () => {
		D ? e.dispatchCommand(T, null) : e.dispatchCommand(J, !0);
	}, G = () => {
		let e = b();
		if (!O(e)) return;
		c(e.hasFormat("bold")), m(e.hasFormat("italic")), g(e.hasFormat("underline")), S(e.hasFormat("code"));
		let t = Y(e), n = j(t, E), r = j(t, A);
		N(n !== null || r !== null);
		let i = ie(e.anchor.getNode());
		i && o(i);
	};
	return z.current = () => {
		let n = b(), a = i.current, o = window.getSelection();
		if (a === null) return;
		let s = e.getRootElement(), c = o !== null, l = c && o.rangeCount > 0, u = !!s?.contains(c ? o.anchorNode : null);
		if (ae({
			hasSelection: n !== null,
			isRangeSelection: O(n),
			isCollapsed: O(n) ? n.isCollapsed() : !1,
			hasNativeSelection: c,
			hasNativeRange: l,
			isAnchorInsideEditor: u,
			isEditorEditable: e.isEditable(),
			isPointerSelecting: R.current
		}) && o) {
			let e = o.getRangeAt(0).getBoundingClientRect();
			e && Q(new DOMRect(e.left, e.bottom, 0, 0), a, t, oe, void 0, "legacy", "viewport"), r(!0);
		} else s !== null && Q(null, a, t, void 0, void 0, "legacy", "viewport"), r(!1);
		return G(), !0;
	}, P(() => {
		let t = e.getRootElement();
		if (!t) return;
		let n = t.ownerDocument, i = () => {
			R.current = !0, r(!1);
		}, a = () => {
			R.current && (R.current = !1, e.getEditorState().read(() => {
				z.current();
			}));
		};
		return t.addEventListener("pointerdown", i), n.addEventListener("pointerup", a), n.addEventListener("pointercancel", a), () => {
			t.removeEventListener("pointerdown", i), n.removeEventListener("pointerup", a), n.removeEventListener("pointercancel", a);
		};
	}, [e, r]), P(() => {
		let n = t.ownerDocument, r = () => {
			e.getEditorState().read(() => {
				z.current();
			});
		};
		return window.addEventListener("resize", r), n.addEventListener("scroll", r, !0), () => {
			window.removeEventListener("resize", r), n.removeEventListener("scroll", r, !0);
		};
	}, [t, e]), P(() => _(e.registerUpdateListener(({ editorState: e }) => {
		e.read(() => {
			z.current();
		});
	}), e.registerCommand(M, (e) => (z.current(), !1), 4), e.registerCommand(v, (e) => {
		let t = b();
		return O(t) && z.current(), !1;
	}, 3)), [e]), /* @__PURE__ */ V(L, {
		ref: i,
		zIndex: "tooltip",
		className: `floating-text-format-toolbar ${n ? "active" : ""}`,
		children: /* @__PURE__ */ V(ee, {
			editor: e,
			blockType: a,
			isBold: s,
			isItalic: d,
			isUnderline: h,
			isCode: y,
			isLink: D,
			formatHeading: B,
			formatList: H,
			formatQuote: U,
			insertLink: W
		})
	});
}
function ce({ anchorElem: e = document.body }) {
	let [t] = N(), [n, r] = I(!1);
	return U(/* @__PURE__ */ V(se, {
		editor: t,
		anchorElem: e,
		isToolbarActive: n,
		setIsToolbarActive: r
	}), document.body);
}
export { q as a, J as i, Q as n, Y as r, ce as t };
