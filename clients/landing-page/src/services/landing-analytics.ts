import { loadAnalytics } from "./analytics";

export const trackActionMenuOpened = () => {
  const properties = { page_path: window.location.pathname };
  void loadAnalytics()
    .then((posthog) => posthog.capture("landing_action_menu_opened", properties))
    .catch(() => {});
};

export const trackWindowControlClicked = (control: "close" | "minimize" | "zoom", windowed: boolean) => {
  const properties = {
    page_path: window.location.pathname,
    control,
    windowed_before: windowed,
    windowed_after: !windowed,
  };
  void loadAnalytics()
    .then((posthog) => posthog.capture("landing_window_control_clicked", properties))
    .catch(() => {});
};
