import type { PromptStudioDesktopApi } from "../desktop-api";

declare global {
  interface Window {
    promptStudioDesktop: PromptStudioDesktopApi;
  }
}
