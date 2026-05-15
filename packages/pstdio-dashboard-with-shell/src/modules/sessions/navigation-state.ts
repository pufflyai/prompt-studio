import { createEmptySessionsNavigationState, type SessionsNavigationController } from "./widgets/sessions-widget";

// Shared so the sessions widget can publish sections and the sessions-browser
// mode's tree view can read them without the two pieces seeing each other.
export const sessionsNavigationState: SessionsNavigationController = {
  current: createEmptySessionsNavigationState(),
};
