// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useTranslation-DvWg4zeU.ts";
import { DeleteConfirmationModal as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-replacement-confirmation.tsx
var r = (r) => {
	let { replacement: i, onClose: a } = r, { t: o } = e("projects");
	return /* @__PURE__ */ n(t, {
		open: i !== null,
		headline: o("projectSettings.extensionsPanel.replace.title", { name: i?.name }),
		notificationText: o("projectSettings.extensionsPanel.replace.message"),
		buttonText: o("projectSettings.extensionsPanel.replace.action"),
		onClose: a,
		onDelete: async () => {
			await i?.retry();
		}
	});
};
export { r as t };
