// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-right-CRFNEcZT.ts";
import { t } from "./file-text-B9-uT4dU.ts";
import { t as n } from "./folder-DJ8ZbA4G.ts";
import { t as r } from "./empty-state-C7gtd4pd.ts";
import { t as i } from "./list-row-BhxGCvIh.ts";
import { useEffect as a, useState as o } from "react";
import { Box as s, Button as c, HStack as l, Icon as u, Menu as d, Portal as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/file-browser/column-file-paths.ts
var _ = (e, t) => {
	let n = [], r = e, i = [];
	n.push({
		items: r,
		selectedFolderId: t[0],
		breadcrumb: i
	});
	for (let e = 0; e < t.length; e++) {
		let a = t[e], o = r.find((e) => e.id === a && e.type === "folder");
		if (!o) break;
		i = [...i, o], r = o.children ?? [], n.push({
			items: r,
			selectedFolderId: t[e + 1],
			breadcrumb: i
		});
	}
	return n;
}, v = (e) => {
	let t = [];
	for (let n = e.length - 1; n >= 0; --n) t.push({
		item: e[n],
		path: []
	});
	for (; t.length > 0;) {
		let e = t.pop();
		if (!e) break;
		let { item: n, path: r } = e;
		if (n.type === "file") {
			if (r.length === 0) continue;
			return {
				path: r,
				file: n
			};
		}
		let i = n.children;
		if (!i || i.length === 0) continue;
		let a = [...r, n];
		for (let e = i.length - 1; e >= 0; --e) t.push({
			item: i[e],
			path: a
		});
	}
	return null;
}, y = (e) => e.filter((e) => e.type === "folder").map((e) => e.id), b = (e) => {
	let t = e[e.length - 1] ?? null;
	return t?.type === "file" ? t.id : null;
}, x = (e, t) => e.length === t.length && e.every((e, n) => e === t[n]), S = (r) => {
	let { item: a, columnIndex: o, breadcrumb: c, selectedFolderId: l, activeFileId: p, allowContextMenu: m, canDeleteItem: _, onFolderOpen: v, onFileOpen: y, onDeleteItem: b, onDownloadFile: x, onDragOver: S, onDropToFolder: C, onUpdateSelectedPath: w, onUpdateActiveFileId: T } = r, E = a.type === "folder", D = [...c, a], O = !!x && !E, k = !!b && (!_ || _(a, D)), A = m && (O || k), j = l === a.id, M = !E && p === a.id, N = () => {
		let e = c.slice(0, o).map((e) => e.id);
		if (E) {
			let t = [...e, a.id];
			w(t), T(null), v?.(a, D);
		} else w(e), T(a.id), y?.(a, D);
	}, P = () => {
		k && b?.(a, D);
	}, F = () => {
		O && x?.(a, D);
	}, I = /* @__PURE__ */ h(i, {
		variant: "compact",
		isSelected: j || M,
		id: a.id,
		label: a.name,
		description: a.meta,
		icon: /* @__PURE__ */ h(u, {
			as: E ? n : t,
			boxSize: "14px"
		}),
		endContent: E ? /* @__PURE__ */ h(u, {
			as: e,
			boxSize: "14px"
		}) : void 0,
		onActivate: N
	}), L = /* @__PURE__ */ h(s, {
		width: "100%",
		onDragOver: E ? S : void 0,
		onDrop: (e) => C(e, a, D),
		children: I
	});
	return A ? /* @__PURE__ */ g(d.Root, { children: [/* @__PURE__ */ h(d.ContextTrigger, {
		asChild: !0,
		children: L
	}), /* @__PURE__ */ h(f, { children: /* @__PURE__ */ h(d.Positioner, { children: /* @__PURE__ */ g(d.Content, {
		minW: "180px",
		bg: "bg",
		zIndex: "popover",
		children: [O ? /* @__PURE__ */ h(d.Item, {
			value: "download",
			onClick: F,
			children: "Download"
		}) : null, k ? /* @__PURE__ */ h(d.Item, {
			value: "delete",
			color: "fg.error",
			onClick: P,
			children: "Delete"
		}) : null]
	}) }) })] }) : /* @__PURE__ */ h(d.Root, { children: L });
}, C = (e) => {
	let { items: t, activePath: n, emptyLabel: i = "This folder is empty.", onFolderOpen: u, onFileOpen: d, onDeleteItem: f, onDownloadFile: C, onDropFiles: w, canDeleteItem: T, onUploadClick: E } = e, [D, O] = o([]), [k, A] = o(null), j = _(t, D), M = t.find((e) => e.type === "folder") ?? null, N = !!(n && n.length > 0), P = (e) => {
		e.preventDefault(), e.stopPropagation();
	}, F = (e, t, n) => {
		e.preventDefault(), e.stopPropagation();
		let r = Array.from(e.dataTransfer?.files ?? []);
		r.length !== 0 && w?.(r, t, n);
	};
	return a(() => {
		if (!n) return;
		let e = y(n), t = b(n);
		x(e, D) && t === k || (O(e), A(t));
	}, [
		k,
		n,
		D
	]), a(() => {
		if (N || D.length > 0 || k) return;
		let e = v(t);
		if (e) {
			let t = e.path.map((e) => e.id), n = e.path[e.path.length - 1] ?? null;
			t.length > 0 && n && (O(t), u?.(n, e.path));
		} else M && (O([M.id]), u?.(M, [M]));
	}, [
		k,
		M,
		N,
		t,
		u,
		D
	]), /* @__PURE__ */ h(p, {
		height: "100%",
		direction: "row",
		gap: "0",
		children: j.map((e, t) => {
			let n = e.breadcrumb.length > 0 && (!!f || !!C), a = e.breadcrumb[e.breadcrumb.length - 1] ?? null;
			return /* @__PURE__ */ g(p, {
				gap: "xs",
				p: "xs",
				height: "100%",
				minW: "240px",
				maxW: "320px",
				borderRightWidth: "1px",
				children: [/* @__PURE__ */ h(l, {
					justify: "flex-end",
					gap: "0",
					children: /* @__PURE__ */ g(m, {
						textStyle: "paragraph/S/regular",
						color: "fg.muted",
						children: [
							e.items.length,
							" item",
							e.items.length === 1 ? "" : "s"
						]
					})
				}), /* @__PURE__ */ g(p, {
					gap: "xs",
					onDragOver: P,
					onDrop: (t) => F(t, a, e.breadcrumb),
					children: [e.items.map((r) => /* @__PURE__ */ h(S, {
						item: r,
						columnIndex: t,
						breadcrumb: e.breadcrumb,
						selectedFolderId: e.selectedFolderId,
						activeFileId: k,
						allowContextMenu: n,
						canDeleteItem: T,
						onFolderOpen: u,
						onFileOpen: d,
						onDeleteItem: f,
						onDownloadFile: C,
						onDragOver: P,
						onDropToFolder: F,
						onUpdateSelectedPath: O,
						onUpdateActiveFileId: A
					}, r.id)), e.items.length === 0 ? /* @__PURE__ */ h(s, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						p: "md",
						height: "100%",
						children: /* @__PURE__ */ h(r, {
							title: i,
							size: "sm",
							textAlign: "left",
							alignItems: "flex-start",
							height: "100%",
							children: E ? /* @__PURE__ */ h(c, {
								size: "sm",
								variant: "outline",
								onClick: E,
								children: "Upload files"
							}) : null
						})
					}) : null]
				})]
			}, e.breadcrumb.map((e) => e.id).join("/") || "root");
		})
	});
}, w = [
	{
		id: "sample-raw",
		name: "sample-raw",
		type: "folder",
		meta: "3 items",
		children: [
			{
				id: "sample-raw/invoices",
				name: "invoices",
				type: "folder",
				meta: "2 items",
				children: [{
					id: "sample-raw/invoices/2024-02.pdf",
					name: "2024-02.pdf",
					type: "file",
					meta: "1.2 MB · Feb 2, 2024"
				}, {
					id: "sample-raw/invoices/2024-03.pdf",
					name: "2024-03.pdf",
					type: "file",
					meta: "980 KB · Mar 8, 2024"
				}]
			},
			{
				id: "sample-raw/contracts",
				name: "contracts",
				type: "folder",
				meta: "1 item",
				children: [{
					id: "sample-raw/contracts/vendor-agreement.pdf",
					name: "vendor-agreement.pdf",
					type: "file",
					meta: "2.1 MB · Jan 18, 2024"
				}]
			},
			{
				id: "sample-raw/notes.md",
				name: "notes.md",
				type: "file",
				meta: "6 KB · Apr 8, 2024"
			}
		]
	},
	{
		id: "sample-artifacts",
		name: "sample-artifacts",
		type: "folder",
		meta: "2 items",
		children: [{
			id: "sample-artifacts/run-042",
			name: "run-042",
			type: "folder",
			meta: "1 item",
			children: [{
				id: "sample-artifacts/run-042/output.json",
				name: "output.json",
				type: "file",
				meta: "48 KB · May 8, 2024"
			}]
		}, {
			id: "sample-artifacts/logs",
			name: "logs",
			type: "folder",
			meta: "0 items",
			children: []
		}]
	},
	{
		id: "sample-validation/summary.csv",
		name: "summary.csv",
		type: "file",
		meta: "18 KB · Jul 20, 2024"
	}
], T = [{
	id: "sample-raw",
	name: "sample-raw",
	type: "folder",
	meta: "0 items",
	children: []
}], E = (e) => e.length === 0 ? "root" : e.map((e) => e.name).join(" / "), D = (e) => `${e} file${e === 1 ? "" : "s"}`, O = (e) => e.type === "file", k = {
	title: "Components/Navigation/Column File Browser",
	component: C,
	decorators: [(e) => /* @__PURE__ */ h(s, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ h(e, {})
	})]
}, A = { render: () => {
	let [e, t] = o("Select a file or folder.");
	return /* @__PURE__ */ g(p, {
		gap: "sm",
		children: [/* @__PURE__ */ h(s, {
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "md",
			overflow: "hidden",
			height: "420px",
			children: /* @__PURE__ */ h(C, {
				items: w,
				emptyLabel: "This folder is empty.",
				onFolderOpen: (e, n) => {
					t(`Opened folder: ${E(n)}`);
				},
				onFileOpen: (e, n) => {
					t(`Opened file: ${E(n)}`);
				},
				onDeleteItem: (e, n) => {
					t(`Deleted ${e.type}: ${E(n)}`);
				},
				onDownloadFile: (e, n) => {
					t(`Downloaded: ${E(n)}`);
				},
				onDropFiles: (e, n, r) => {
					let i = D(e.length);
					t(`Dropped ${i} into ${E(r)}`);
				},
				onUploadClick: () => {
					t("Upload clicked.");
				},
				canDeleteItem: O
			})
		}), /* @__PURE__ */ h(m, {
			textStyle: "paragraph/XS/regular",
			color: "fg.muted",
			children: e
		})]
	});
} }, j = { render: () => {
	let [e, t] = o("Drop files here to upload.");
	return /* @__PURE__ */ g(p, {
		gap: "sm",
		children: [/* @__PURE__ */ h(s, {
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "md",
			overflow: "hidden",
			height: "280px",
			children: /* @__PURE__ */ h(C, {
				items: T,
				emptyLabel: "Nothing here yet.",
				onFolderOpen: (e, n) => {
					t(`Opened folder: ${E(n)}`);
				},
				onDropFiles: (e, n, r) => {
					let i = D(e.length);
					t(`Dropped ${i} into ${E(r)}`);
				},
				onUploadClick: () => {
					t("Upload clicked.");
				}
			})
		}), /* @__PURE__ */ h(m, {
			textStyle: "paragraph/XS/regular",
			color: "fg.muted",
			children: e
		})]
	});
} };
export { A as Default, j as EmptyFolder, k as default };
