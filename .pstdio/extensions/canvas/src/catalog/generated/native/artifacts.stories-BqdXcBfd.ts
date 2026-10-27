// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t, t as n } from "./artifact-translation-story-DxPvkIDo.ts";
import { t as r } from "./html-preview-DhmLvXIL.ts";
import { useEffect as i, useEffectEvent as a, useRef as o, useState as s } from "react";
import { Box as c, Button as l, Center as u, Separator as d, SimpleGrid as f, Stack as p, Text as m } from "@chakra-ui/react";
import { EmptyState as h, ScrollArea as g, SimpleCard as _, SimpleCardBody as v, Tooltip as y, createGlyphIcon as b } from "@pstdio/ui";
import { jsx as x, jsxs as S } from "react/jsx-runtime";
// extensions/pstdio-artifacts/src/components/artifact-creation-examples.tsx
var C = b("document-text-1"), w = b("schema"), T = (e) => {
	let { onCreate: n, creating: r } = e, { t: i } = t(), a = [{
		id: "brief",
		Icon: C,
		title: i("library.briefTitle", "Project brief"),
		description: i("library.briefDescription", "Goals, decisions, and next steps")
	}, {
		id: "diagram",
		Icon: w,
		title: i("library.diagramTitle", "System diagram"),
		description: i("library.diagramDescription", "Components, connections, and data flow")
	}];
	return /* @__PURE__ */ S(p, {
		gap: "md",
		children: [/* @__PURE__ */ S(p, {
			gap: "xs",
			children: [/* @__PURE__ */ x(m, {
				textStyle: "paragraph/S/medium",
				children: i("library.makeNew", "Make something new")
			}), /* @__PURE__ */ x(m, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: i("library.creationHint", "Choose an example to start an agent session, or ask any session to create and publish an interactive page. It will appear here.")
			})]
		}), /* @__PURE__ */ x(p, {
			direction: "row",
			flexWrap: "wrap",
			gap: "sm",
			children: a.map((e) => /* @__PURE__ */ x(y, {
				content: e.description,
				openDelay: 300,
				children: /* @__PURE__ */ S(l, {
					variant: "outline",
					size: "sm",
					borderRadius: "pill",
					"aria-label": e.title,
					"aria-busy": r === e.id,
					disabled: !!r,
					loading: r === e.id,
					onClick: () => n(e.id),
					children: [/* @__PURE__ */ x(e.Icon, { "aria-hidden": "true" }), e.title]
				})
			}, e.id))
		})]
	});
}, E = b("document-code"), D = (e) => {
	let { item: n, loadPreview: l } = e, { t: d } = t(), f = o(null), [p, m] = s(), h = a((e) => l(e));
	return i(() => {
		let e = !1, t = new IntersectionObserver((r) => {
			r.some((e) => e.isIntersecting) && (t.disconnect(), h(n).then((t) => {
				e || m(t);
			}).catch(() => {}));
		});
		return f.current && t.observe(f.current), () => {
			e = !0, t.disconnect();
		};
	}, [n]), /* @__PURE__ */ x(c, {
		ref: f,
		aspectRatio: 16 / 10,
		overflow: "hidden",
		bg: "bg.muted",
		"aria-hidden": "true",
		inert: !0,
		pointerEvents: "none",
		children: p === void 0 ? /* @__PURE__ */ x(u, {
			height: "full",
			color: "fg.muted",
			children: /* @__PURE__ */ x(E, {})
		}) : /* @__PURE__ */ x(c, {
			width: "400%",
			height: "400%",
			transform: "scale(0.25)",
			transformOrigin: "top left",
			children: /* @__PURE__ */ x(r, {
				html: p,
				title: d("library.thumbnail", "Thumbnail: {{title}}", { title: n.title })
			})
		})
	});
}, O = (e, { t, locale: n }) => {
	let r = new Date(e), i = Math.max(0, Math.floor((Date.now() - r.getTime()) / 36e5));
	return i === 0 ? t("library.editedNow", "Edited just now") : i < 24 ? t("library.editedAt", "Edited {{date}}", { date: new Intl.RelativeTimeFormat(n, { numeric: "auto" }).format(-i, "hour") }) : i < 48 ? t("library.editedYesterday", "Edited yesterday") : t("library.editedAt", "Edited {{date}}", { date: r.toLocaleDateString(n, {
		month: "short",
		day: "numeric"
	}) });
}, k = (e) => {
	let { items: n, onOpen: r, loadPreview: i, onCreate: a, creating: o } = e, s = t(), { t: c } = s;
	return /* @__PURE__ */ x(p, {
		height: "full",
		minHeight: "0",
		gap: "0",
		children: /* @__PURE__ */ x(g, {
			flex: "1",
			minHeight: "0",
			children: /* @__PURE__ */ S(p, {
				gap: "lg",
				p: "lg",
				width: "full",
				maxWidth: "4xl",
				mx: "auto",
				children: [
					/* @__PURE__ */ x(T, {
						onCreate: a,
						creating: o
					}),
					/* @__PURE__ */ x(d, {}),
					n.length ? /* @__PURE__ */ x(f, {
						columns: {
							base: 1,
							md: 2,
							lg: 3
						},
						gap: "lg",
						children: n.map((e) => /* @__PURE__ */ x(_, {
							asChild: !0,
							overflow: "hidden",
							textAlign: "left",
							cursor: "pointer",
							focusVisibleRing: "outside",
							_hover: { borderColor: "border" },
							children: /* @__PURE__ */ S("button", {
								type: "button",
								"aria-label": e.title,
								onClick: () => r(e),
								children: [/* @__PURE__ */ x(D, {
									item: e,
									loadPreview: i
								}), /* @__PURE__ */ x(v, { children: /* @__PURE__ */ S(p, {
									gap: "xs",
									children: [/* @__PURE__ */ x(m, {
										textStyle: "paragraph/S/medium",
										truncate: !0,
										children: e.title
									}), /* @__PURE__ */ x(m, {
										textStyle: "paragraph/XS/regular",
										color: "fg.muted",
										children: O(e.publishedAt, s)
									})]
								}) })]
							})
						}, e.artifactId))
					}) : /* @__PURE__ */ x(h, {
						title: c("library.emptyTitle", "Your first artifact starts with an idea"),
						description: c("library.emptyHint", "Ask an agent to create and publish an interactive HTML page.")
					})
				]
			})
		})
	});
}, A = {
	title: "Extensions/Artifacts/Library",
	component: k,
	decorators: [(e) => /* @__PURE__ */ x(n, { children: /* @__PURE__ */ x(e, {}) })],
	args: {
		items: [e],
		onOpen: () => {},
		onCreate: () => {},
		loadPreview: async (e) => `<html><body><h1>${e.title}</h1><p>A saved interactive page.</p><h2>Overview</h2><p>Project notes and the next steps.</p></body></html>`
	}
}, j = {}, M = { args: { items: [] } }, N = { args: { creating: "brief" } }, P = { args: { items: [
	"Release overview",
	"Research notes",
	"Experiment tracker",
	"Team handbook",
	"Sprint overview",
	"A long investigation title that should remain readable in a compact library"
].map((t, n) => ({
	...e,
	artifactId: `artifact-${n}`,
	title: t
})) } }, F = {
	args: { items: Array.from({ length: 30 }, (t, n) => ({
		...e,
		artifactId: `artifact-${n}`,
		title: `Prototype ${n + 1}`
	})) },
	decorators: [(e) => /* @__PURE__ */ x(p, {
		height: "lg",
		children: /* @__PURE__ */ x(e, {})
	})]
}, I = { decorators: [(e) => /* @__PURE__ */ x(p, {
	width: "xs",
	height: "lg",
	children: /* @__PURE__ */ x(e, {})
})] }, L = { args: { loadPreview: async () => {
	throw Error("Preview unavailable");
} } }, R = () => {
	let [t, n] = s(0);
	return /* @__PURE__ */ S(p, {
		height: "full",
		children: [/* @__PURE__ */ S(m, { children: ["Host updates: ", t] }), /* @__PURE__ */ x(k, {
			items: [e],
			onOpen: () => {},
			onCreate: () => {},
			loadPreview: async () => (n(t + 1), await new Promise((e) => setTimeout(e, 50)), "<h1>Saved preview</h1>")
		})]
	});
}, z = { render: () => /* @__PURE__ */ x(R, {}) }, B = { decorators: [(e) => /* @__PURE__ */ x(n, {
	locale: "fr",
	children: /* @__PURE__ */ x(e, {})
})] };
export { M as Empty, B as French, z as HostUpdates, P as ManyArtifacts, I as NarrowLibrary, j as Published, F as ScrollableLibrary, N as StartingSession, L as UnavailablePreview, A as default };
