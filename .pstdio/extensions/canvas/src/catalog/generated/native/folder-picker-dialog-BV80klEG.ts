// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-DUoQ-jFn.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./folder-plus-DzlYc4m_.ts";
import { t as r } from "./folder-DJ8ZbA4G.ts";
import { t as i } from "./hard-drive-4cCgpz5D.ts";
import { t as a } from "./house-BBkmrnwf.ts";
import { t as o } from "./search-FHo0INnP.ts";
import { t as s } from "./scroll-area-I7hjn89T.ts";
import { r as c, t as l } from "./list-row-BhxGCvIh.ts";
import { useEffect as u, useState as d } from "react";
import { Box as f, Button as p, Dialog as m, Input as h, InputGroup as g, Text as _, useSlotRecipe as v } from "@chakra-ui/react";
import { Fragment as y, jsx as b, jsxs as x } from "react/jsx-runtime";
// packages/ui/src/components/overlays/folder-picker-drive-menu.tsx
var S = (e) => {
	let { drives: n, currentPath: r, disabled: a, onNavigate: o } = e, s = v({ key: "folderPicker" })({}), l = r.match(/^[a-z]:[\\/]/i)?.[0].replaceAll("\\", "/").toUpperCase(), u = n.find((e) => e.path.replaceAll("\\", "/").toUpperCase() === l);
	return /* @__PURE__ */ b(c, {
		trigger: /* @__PURE__ */ x(p, {
			size: "sm",
			variant: "ghost",
			css: s.driveTrigger,
			"aria-label": "Drive",
			disabled: a,
			children: [
				/* @__PURE__ */ b(i, {}),
				u?.name ?? l?.slice(0, 2) ?? "Drive",
				/* @__PURE__ */ b(t, {})
			]
		}),
		items: n.map((e) => ({
			id: e.path,
			label: e.name,
			icon: i,
			isSelected: e === u,
			onSelect: () => o(e.path)
		})),
		header: /* @__PURE__ */ b(_, {
			css: s.driveLabel,
			children: "Drives"
		}),
		width: "60",
		showSearch: !1,
		searchPlaceholder: "Search drives",
		emptyState: "No drives available.",
		portalled: !1,
		positioning: {
			placement: "bottom-start",
			strategy: "fixed",
			hideWhenDetached: !0
		}
	});
}, C = (e) => {
	let { entries: t, query: n, isLoading: i, isUnavailable: a, disabled: o, onNavigate: c } = e, u = v({ key: "folderPicker" })({}), d = t.filter((e) => e.isDirectory && e.name.toLocaleLowerCase().includes(n.toLocaleLowerCase()));
	return /* @__PURE__ */ b(s, {
		css: u.list,
		children: /* @__PURE__ */ x(f, {
			css: u.rows,
			"aria-label": "Folders",
			children: [
				i && /* @__PURE__ */ b(_, {
					color: "fg.muted",
					children: "Loading folders..."
				}),
				!i && a && /* @__PURE__ */ b(_, {
					color: "fg.muted",
					children: "Choose another drive, enter a folder path, or go Home."
				}),
				!i && !a && d.length === 0 && /* @__PURE__ */ b(_, {
					color: "fg.muted",
					children: n ? "No matching folders." : "This folder is empty."
				}),
				!i && d.map((e) => /* @__PURE__ */ b(l, {
					id: e.path,
					label: e.name,
					icon: /* @__PURE__ */ b(r, {}),
					disabled: o,
					onActivate: () => c(e.path)
				}, e.path))
			]
		})
	});
}, w = (t) => {
	let { currentPath: r, entries: i, drives: s = [], isUnavailable: c, isLoading: l, isOpening: w, error: T, onClose: E, onSelect: D, onNavigate: O, onCreateFolder: k } = t, A = v({ key: "folderPicker" })({}), [j, M] = d(r), [N, P] = d(r), [F, I] = d(""), [L, R] = d(!1);
	u(() => {
		let e = (e) => {
			e.defaultPrevented || e.repeat || e.altKey || (e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "Period" && (e.preventDefault(), e.stopPropagation(), R((e) => !e));
		};
		return document.addEventListener("keydown", e, !0), () => document.removeEventListener("keydown", e, !0);
	}, []);
	let [z, B] = d(!1), [V, H] = d(""), [U, W] = d(!1);
	r !== N && (P(r), M(r), I(""));
	let G = r.replaceAll("\\", "/"), K = G.match(/^\/\/[^/]+\/[^/]+/)?.[0] ?? G.match(/^[a-z]:\//i)?.[0] ?? "/", q = G.replace(/\/+$/, "").split("/").slice(0, -1).join("/"), J = q.length < K.length ? K : q, Y = G.replace(/\/+$/, "") === K.replace(/\/+$/, ""), X = (e) => {
		B(!1), H(""), O(e);
	}, Z = async () => {
		if (V.trim()) {
			W(!0);
			try {
				await k(V), B(!1), H("");
			} catch {} finally {
				W(!1);
			}
		}
	};
	return /* @__PURE__ */ x(y, { children: [
		/* @__PURE__ */ b(m.Header, {
			css: A.header,
			children: /* @__PURE__ */ b(m.Title, { children: "Open project folder" })
		}),
		/* @__PURE__ */ x(m.Body, {
			css: A.body,
			"aria-keyshortcuts": "Meta+Shift+. Control+Shift+.",
			children: [
				/* @__PURE__ */ x(f, {
					css: A.navigation,
					children: [
						/* @__PURE__ */ b(p, {
							size: "sm",
							variant: "outline",
							css: A.navigationButton,
							"aria-label": "Go to home directory",
							disabled: l || w || U,
							onClick: () => X("~"),
							children: /* @__PURE__ */ b(a, {})
						}),
						/* @__PURE__ */ b(p, {
							size: "sm",
							variant: "outline",
							css: A.navigationButton,
							"aria-label": "Go to parent directory",
							disabled: l || w || U || Y || !r || c,
							onClick: () => X(J),
							children: /* @__PURE__ */ b(e, {})
						}),
						s.length > 0 && /* @__PURE__ */ b(S, {
							drives: s,
							currentPath: r,
							disabled: !!(l || w || U),
							onNavigate: X
						}),
						/* @__PURE__ */ b(h, {
							css: A.path,
							size: "sm",
							variant: "borderless",
							title: j,
							"aria-label": "Folder path",
							value: j,
							onChange: (e) => M(e.target.value),
							onKeyDown: (e) => {
								e.key === "Enter" && X(j);
							},
							disabled: l || w || U
						}),
						!z && /* @__PURE__ */ x(p, {
							variant: "outline",
							size: "sm",
							disabled: !r || c || l || w,
							onClick: () => B(!0),
							children: [/* @__PURE__ */ b(n, {}), "New folder"]
						})
					]
				}),
				!z && /* @__PURE__ */ b(g, {
					css: A.filter,
					startElement: /* @__PURE__ */ b(o, {}),
					children: /* @__PURE__ */ b(h, {
						size: "sm",
						"aria-label": "Filter folders",
						placeholder: "Filter folders",
						value: F,
						disabled: c,
						onChange: (e) => I(e.target.value)
					})
				}),
				z && /* @__PURE__ */ x(f, {
					css: A.creation,
					children: [/* @__PURE__ */ b(h, {
						size: "sm",
						"aria-label": "New folder name",
						placeholder: "New folder name",
						autoFocus: !0,
						value: V,
						onChange: (e) => H(e.target.value),
						onKeyDown: (e) => {
							e.key === "Enter" && Z();
						}
					}), /* @__PURE__ */ x(p, {
						size: "sm",
						variant: "primary",
						disabled: !V.trim(),
						loading: U,
						onClick: Z,
						children: [/* @__PURE__ */ b(n, {}), "Create folder"]
					})]
				}),
				T && /* @__PURE__ */ b(_, {
					role: "alert",
					color: "fg.error",
					textStyle: "paragraph/S/regular",
					children: T
				}),
				/* @__PURE__ */ b(C, {
					entries: i.filter((e) => L || !e.name.startsWith(".")),
					query: F,
					isLoading: l,
					isUnavailable: c,
					disabled: !!(l || w || U),
					onNavigate: X
				})
			]
		}),
		/* @__PURE__ */ x(m.Footer, {
			css: A.footer,
			children: [/* @__PURE__ */ b(p, {
				size: "sm",
				variant: "outline",
				onClick: E,
				disabled: l || w || U,
				children: "Cancel"
			}), !z && /* @__PURE__ */ b(p, {
				size: "sm",
				variant: "primary",
				onClick: D,
				loading: w,
				disabled: !r || c || l || U,
				children: "Open folder"
			})]
		})
	] });
}, T = (e) => {
	let t = v({ key: "folderPicker" })({});
	return /* @__PURE__ */ x(m.Root, {
		placement: "center",
		scrollBehavior: "inside",
		open: e.open,
		onOpenChange: (t) => {
			t.open || e.onClose();
		},
		closeOnInteractOutside: !1,
		lazyMount: !0,
		unmountOnExit: !0,
		children: [/* @__PURE__ */ b(m.Backdrop, {}), /* @__PURE__ */ b(m.Positioner, { children: /* @__PURE__ */ b(m.Content, {
			css: t.content,
			children: /* @__PURE__ */ b(w, { ...e })
		}) })]
	});
};
export { T as t };
