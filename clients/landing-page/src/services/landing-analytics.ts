import posthog from "posthog-js";

export const trackActionMenuOpened = () => {
  posthog.capture("landing_action_menu_opened", { page_path: window.location.pathname });
};

export const trackWindowControlClicked = (control: "close" | "minimize" | "zoom", windowed: boolean) => {
  posthog.capture("landing_window_control_clicked", {
    page_path: window.location.pathname,
    control,
    windowed_before: windowed,
    windowed_after: !windowed,
  });
};
