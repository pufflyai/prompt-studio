// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./file-text-B9-uT4dU.ts";
import { t } from "./folder-DJ8ZbA4G.ts";
import { t as n } from "./empty-state-C7gtd4pd.ts";
import { Box as r, Button as i, Icon as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/primitives/empty-state.stories.tsx
var s = {
	title: "Components/Feedback/Empty State",
	component: n,
	decorators: [(e) => /* @__PURE__ */ o(r, {
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ o(e, {})
	})],
	args: {
		title: "No documents yet.",
		description: "Upload files to start building extractions."
	}
}, c = { render: (e) => /* @__PURE__ */ o(r, {
	width: "100%",
	maxWidth: "420px",
	children: /* @__PURE__ */ o(n, { ...e })
}) }, l = {
	args: {
		title: "Nothing uploaded yet.",
		description: "Drop files into sample-raw or use the upload action.",
		icon: /* @__PURE__ */ o(a, {
			as: e,
			boxSize: "28px",
			color: "fg.muted"
		})
	},
	render: (e) => /* @__PURE__ */ o(r, {
		width: "100%",
		maxWidth: "420px",
		children: /* @__PURE__ */ o(n, {
			...e,
			children: /* @__PURE__ */ o(i, {
				size: "sm",
				variant: "outline",
				children: "Upload files"
			})
		})
	})
}, u = {
	args: {
		title: "This folder is empty.",
		size: "sm",
		textAlign: "left",
		alignItems: "flex-start",
		icon: /* @__PURE__ */ o(a, {
			as: t,
			boxSize: "20px",
			color: "fg.muted"
		})
	},
	render: (e) => /* @__PURE__ */ o(r, {
		width: "100%",
		maxWidth: "420px",
		children: /* @__PURE__ */ o(n, { ...e })
	})
};
export { u as Compact, c as Default, l as WithIconAndAction, s as default };
