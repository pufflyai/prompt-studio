export const english = {
  "installations.description": "Installation Overview",
  "installations.title": "Installation Overview",
  "installations.dismiss": "Dismiss installation overview",
  "installations.loading": "Loading installations",
  "installations.empty": "No installations",
  "installations.queued": "Queued",
  "installations.retry": "Retry",
  "installations.failed": "Installation failed",
  "installations.complete": "Installation complete",
};
export type Message = keyof typeof english;
export type Translate = (key: Message) => string;
