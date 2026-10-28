import type { WebviewHostProps } from "@pstdio/sdk/extensions";

export const english = {
  "installations.title": "Installing Extensions",
  "installations.empty": "No installations",
  "installations.queued": "Queued",
  "installations.retry": "Retry",
  "installations.failed": "Installation failed",
  "installations.complete": "Installation complete",
};
export type Message = keyof typeof english;
export type Translate = (key: Message) => string;
export const translator =
  (props: WebviewHostProps): Translate =>
  (key) =>
    props.translations.bundle[key] ?? props.translations.defaultBundle[key] ?? english[key];
