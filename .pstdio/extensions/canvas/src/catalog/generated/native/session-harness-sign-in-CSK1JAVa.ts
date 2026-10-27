// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./log-in-BK-Y1G4z.ts";
import { t } from "./useTranslation-DvWg4zeU.ts";
import { Button as n, Icon as r } from "@chakra-ui/react";
import { EmptyState as i } from "@pstdio/ui";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/components/session-harness-sign-in.tsx
var o = (o) => {
	let { name: s, onLogin: c } = o, { t: l } = t("projects");
	return /* @__PURE__ */ a(i, {
		title: l("harnessAccount.loginTitle", { name: s }),
		description: l("harnessAccount.requiredDescription"),
		icon: /* @__PURE__ */ a(r, {
			as: e,
			boxSize: "12"
		}),
		children: /* @__PURE__ */ a(n, {
			size: "sm",
			variant: "outline",
			onClick: c,
			children: l("harnessAccount.login")
		})
	});
};
export { o as t };
