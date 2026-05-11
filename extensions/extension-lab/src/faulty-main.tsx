// Deliberately throws during module evaluation so the host's webview bridge
// surfaces the error in the WebviewLoadError UI.
throw new Error("Lab faulty webview: this module fails on purpose to exercise the host error display.");

export {};
