// Internal host lifecycle error. Provider errors must never trigger a native action retry.
export class HarnessDisposedError extends Error {}
