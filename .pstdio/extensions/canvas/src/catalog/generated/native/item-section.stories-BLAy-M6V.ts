// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./file-text-B9-uT4dU.ts";
import { t } from "./folder-DJ8ZbA4G.ts";
import { t as n } from "./settings-DjkPFa7Q.ts";
import { t as r } from "./star-DtQKFyMr.ts";
import { t as i } from "./list-row-BhxGCvIh.ts";
import { t as a } from "./item-section-CZ4HC5oB.ts";
import { Box as o, Icon as s, Menu as c, Stack as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/layout/item-section.stories.tsx
var f = {
	title: "Components/Layout/Item Section",
	component: a,
	decorators: [(e) => /* @__PURE__ */ u(o, {
		padding: "lg",
		background: "bg",
		maxWidth: "300px",
		children: /* @__PURE__ */ u(e, {})
	})]
}, p = (e) => {
	let { id: t, label: n, description: r, icon: a, disabled: o } = e;
	return /* @__PURE__ */ u(c.Item, {
		value: t,
		asChild: !0,
		children: /* @__PURE__ */ u(i, {
			asChild: !0,
			variant: "full-width",
			label: n,
			description: r,
			icon: a,
			disabled: o
		})
	});
}, m = { render: () => /* @__PURE__ */ u(a, {
	title: "Files",
	children: /* @__PURE__ */ u(c.Root, { children: /* @__PURE__ */ d(l, {
		gap: "0",
		paddingLeft: "xs",
		paddingY: "xs",
		children: [
			/* @__PURE__ */ u(p, {
				id: "overview",
				label: "Project Overview",
				icon: /* @__PURE__ */ u(s, {
					as: e,
					boxSize: "16px"
				})
			}),
			/* @__PURE__ */ u(p, {
				id: "assets",
				label: "Assets",
				icon: /* @__PURE__ */ u(s, {
					as: t,
					boxSize: "16px"
				})
			}),
			/* @__PURE__ */ u(p, {
				id: "settings",
				label: "Settings",
				icon: /* @__PURE__ */ u(s, {
					as: n,
					boxSize: "16px"
				})
			})
		]
	}) })
}) }, h = { render: () => /* @__PURE__ */ d(l, {
	gap: "sm",
	children: [/* @__PURE__ */ u(a, {
		title: "Favorites",
		children: /* @__PURE__ */ u(c.Root, { children: /* @__PURE__ */ d(l, {
			gap: "0",
			paddingLeft: "xs",
			paddingY: "xs",
			children: [/* @__PURE__ */ u(p, {
				id: "dashboard",
				label: "Main Dashboard",
				icon: /* @__PURE__ */ u(s, {
					as: r,
					boxSize: "16px"
				})
			}), /* @__PURE__ */ u(p, {
				id: "reports",
				label: "Reports",
				icon: /* @__PURE__ */ u(s, {
					as: e,
					boxSize: "16px"
				})
			})]
		}) })
	}), /* @__PURE__ */ u(a, {
		title: "Recent",
		defaultOpen: !1,
		children: /* @__PURE__ */ u(c.Root, { children: /* @__PURE__ */ d(l, {
			gap: "0",
			paddingLeft: "xs",
			paddingY: "xs",
			children: [/* @__PURE__ */ u(p, {
				id: "alpha",
				label: "Project Alpha",
				icon: /* @__PURE__ */ u(s, {
					as: t,
					boxSize: "16px"
				})
			}), /* @__PURE__ */ u(p, {
				id: "beta",
				label: "Project Beta",
				icon: /* @__PURE__ */ u(s, {
					as: t,
					boxSize: "16px"
				})
			})]
		}) })
	})]
}) }, g = { render: () => /* @__PURE__ */ u(a, {
	title: "Members",
	children: /* @__PURE__ */ u(c.Root, { children: /* @__PURE__ */ d(l, {
		gap: "0",
		paddingLeft: "xs",
		paddingY: "xs",
		children: [
			/* @__PURE__ */ u(p, {
				id: "john",
				label: "John Doe",
				description: "Admin"
			}),
			/* @__PURE__ */ u(p, {
				id: "jane",
				label: "Jane Smith",
				description: "Editor"
			}),
			/* @__PURE__ */ u(p, {
				id: "bob",
				label: "Bob Wilson",
				description: "Viewer",
				disabled: !0
			})
		]
	}) })
}) };
export { m as Default, h as MultipleSections, g as WithSecondaryLabels, f as default };
