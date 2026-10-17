export class EnvironmentAccessDenied extends Error {
  constructor() {
    super("Environment access unavailable");
  }
}

export class EnvironmentAccessFailure extends Error {
  constructor(readonly category: "database" | "signing") {
    super("Environment access service unavailable");
  }
}
