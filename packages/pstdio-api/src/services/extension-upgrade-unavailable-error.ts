export class ExtensionUpgradeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionUpgradeUnavailableError";
  }
}
