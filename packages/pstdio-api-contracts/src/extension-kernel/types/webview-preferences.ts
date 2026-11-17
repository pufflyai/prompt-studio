export interface WebviewPreferencesGetParams {
  /** Access to another extension's registered names is deprecated. Use names owned by the caller. */
  name: string;
  scope?: {
    scope: "default" | "user" | "project" | "workspace" | "extension" | "session";
    scopeId?: string;
  };
}

export interface WebviewPreferencesSetParams extends WebviewPreferencesGetParams {
  value: boolean | number | string | string[] | number[] | boolean[] | Record<string, unknown>;
}
