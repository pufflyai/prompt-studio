import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { defaultThemePreferences, ThemePreferenceProvider } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { openRelatedResourcesPreference } from "@pstdio/workbench/react";
import { useState } from "react";
import { CustomizationsSettingsContent } from "./customizations-settings-panel";
import { OnboardingSettingsContent } from "./onboarding-settings-section";

const themePreferences = [
  ...defaultThemePreferences,
  { id: "lab.paper", title: "Paper", mode: "light" as const },
  { id: "lab.ember", title: "Ember", mode: "dark" as const },
];
const Example = (props: { initialHidden: boolean }) => {
  const { initialHidden } = props;
  const [hidden, setHidden] = useState(initialHidden);
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    workbench.preferences.registerSchema({
      properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
    });
    return workbench;
  });
  return (
    <CustomizationsSettingsContent
      workbench={workbench}
      onboarding={<OnboardingSettingsContent hidden={hidden} onChange={setHidden} />}
    />
  );
};
const meta = {
  title: "Settings/Customizations",
  component: Example,
  args: { initialHidden: false },
  decorators: [
    (Story) => (
      <ThemePreferenceProvider initialPreference="pstdio-dark" themePreferences={themePreferences}>
        <Story />
      </ThemePreferenceProvider>
    ),
  ],
} satisfies CanvasMeta<typeof Example>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Default: Story = { id: "settings-customizations--default" };
export const Hidden: Story = { id: "settings-customizations--hidden", args: { initialHidden: true } };
