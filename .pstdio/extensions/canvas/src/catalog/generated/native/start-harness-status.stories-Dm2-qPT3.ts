// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./start-harness-status-UhZXNGRg.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/start/components/start-harness-status.stories.tsx
var r = {
	id: "example.remote.harness.helper",
	name: "Remote helper",
	availability: { type: "INSTALLED" },
	capabilities: [],
	supportsModels: !1
}, i = {
	...r,
	availability: {
		type: "NOT_FOUND",
		reason: "Connect a machine in this extension's settings."
	}
}, a = {
	title: "Start/HarnessStatus",
	component: e,
	parameters: { layout: "padded" },
	decorators: [(e) => /* @__PURE__ */ n(t, {
		maxW: "52rem",
		children: /* @__PURE__ */ n(e, {})
	})],
	args: {
		agents: [],
		onReviewExtensions: () => void 0,
		onCheckAgain: () => void 0
	}
}, o = {}, s = { args: { agents: [i, {
	...i,
	id: "example.local.harness.helper",
	name: "Local helper",
	availability: { type: "NOT_FOUND" }
}] } }, c = { args: { agents: [r] } }, l = { args: { agents: [i, {
	...r,
	id: "example.other.harness.helper"
}] } }, u = { args: {
	isPending: !0,
	isFetching: !0
} }, d = { args: { isError: !0 } }, f = { args: {
	agents: [i],
	isError: !0
} }, p = {
	decorators: [(e) => /* @__PURE__ */ n(t, {
		maxW: "20rem",
		children: /* @__PURE__ */ n(e, {})
	})],
	args: { agents: [i] }
};
export { s as AllUnavailable, c as AvailableWithoutModels, d as CheckFailed, u as Checking, l as MixedAvailability, p as Narrow, o as NoHarnesses, f as RefreshFailed, a as default };
