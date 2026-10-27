// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./checkbox-C3JJ0TWQ.ts";
import { t } from "./delete-confirmation-modal-CYhD_8An.ts";
import { useState as n } from "react";
import { Box as r, Button as i, Stack as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/overlays/delete-confirmation-modal.stories.tsx
var l = {
	title: "Components/Overlays/Delete Confirmation Modal",
	component: t,
	decorators: [(e) => /* @__PURE__ */ s(r, {
		minH: "320px",
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ s(e, {})
	})]
}, u = { render: () => {
	let [e, r] = n(!0);
	return /* @__PURE__ */ c(a, {
		gap: "md",
		children: [
			/* @__PURE__ */ s(o, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: "Use the button below to reopen the confirmation modal after closing it."
			}),
			/* @__PURE__ */ s(i, {
				size: "sm",
				variant: "outline",
				onClick: () => r(!0),
				children: "Open confirmation modal"
			}),
			/* @__PURE__ */ s(t, {
				open: e,
				onClose: () => r(!1),
				onDelete: () => r(!1),
				headline: "Delete pipeline?",
				notificationText: "Deleting this pipeline will remove all versions. This action cannot be undone.",
				buttonText: "Delete pipeline"
			})
		]
	});
} }, d = { render: () => {
	let [r, o] = n(!0), [l, u] = n(!1);
	return /* @__PURE__ */ c(a, {
		gap: "md",
		children: [/* @__PURE__ */ s(i, {
			size: "sm",
			variant: "outline",
			onClick: () => o(!0),
			children: "Open confirmation modal"
		}), /* @__PURE__ */ s(t, {
			open: r,
			onClose: () => {
				o(!1), u(!1);
			},
			onDelete: () => o(!1),
			headline: "Uninstall extension?",
			notificationText: "This removes \"Planner\" and deletes its installed files. Its stored data is kept so reinstalling restores it.",
			buttonText: "Uninstall",
			children: /* @__PURE__ */ s(e, {
				checked: l,
				onCheckedChange: (e) => u(e.checked === !0),
				children: "Also delete this extension's data (cannot be undone)"
			})
		})]
	});
} };
export { u as Default, d as WithOptInCheckbox, l as default };
