import { DesktopSidecarError } from "../runtime/sidecar-artifact";
import type { DesktopRecoveryError } from "./lifecycle-machine";

const recoveryCode = (detail: string): DesktopRecoveryError["code"] => {
  if (detail.startsWith("port_bind_failure:")) return "port_bind_failure";
  if (detail.startsWith("pglite_ownership_conflict:")) return "pglite_ownership_conflict";
  if (detail.startsWith("pglite_recovery_failure:")) return "pglite_recovery_failure";
  if (detail.includes("timed out")) return "runtime_timeout";
  return "unexpected_exit";
};

export const recoveryError = (error: unknown): DesktopRecoveryError => {
  if (error instanceof DesktopSidecarError) {
    return {
      code: error.code === "missing_sidecar" ? "sidecar_missing" : error.code,
      message: error.message.slice(error.message.indexOf(": ") + 2),
      actions: ["open_logs", "copy_diagnostics", "quit"],
    };
  }
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.includes("sidecar is missing")) {
    return {
      code: "sidecar_missing",
      message: "The packaged Prompt Studio runtime could not be found.",
      actions: ["open_logs", "copy_diagnostics", "quit"],
    };
  }
  if (detail.includes("invalid_descriptor") || detail.includes("ownership is unsafe")) {
    return {
      code: "runtime_ownership_uncertain",
      message: "Prompt Studio found a runtime whose ownership could not be verified safely.",
      actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
    };
  }
  return {
    code: recoveryCode(detail),
    message: detail.includes(": ")
      ? detail.slice(detail.indexOf(": ") + 2)
      : "Prompt Studio could not start its runtime.",
    actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
  };
};
