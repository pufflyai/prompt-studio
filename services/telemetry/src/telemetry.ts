const projectToken = "phc_CWtFFzVtjHocyACrXxJ3och8zJsJA3JjeqdViTWMN94H";
const failures = {
  request_exception: "$exception",
  renewal_database_failed: "service_operation_failed",
  renewal_signing_failed: "service_operation_failed",
  renewal_service_failed: "service_operation_failed",
  sync_initialize_failed: "service_operation_failed",
  sync_snapshot_failed: "service_operation_failed",
  sync_replay_failed: "service_operation_failed",
  sync_submit_failed: "service_operation_failed",
  sync_recover_failed: "service_operation_failed",
  sync_subscription_failed: "service_operation_failed",
  sync_document_failed: "service_operation_failed",
  sync_cleanup_failed: "service_operation_failed",
  asset_operation_failed: "service_operation_failed",
} as const;
export type ServiceFailure = keyof typeof failures;
export type ReportFailure = (failure: ServiceFailure) => void;

interface TelemetryOptions {
  /** Owned loopback receivers are for tests only. Production always uses the selected EU destination. */
  endpoint?: string;
}

export const createServiceTelemetry = (
  env: Record<string, string | undefined>,
  service: "manager" | "relay",
  options: TelemetryOptions = {},
) => {
  const environment = env.TELEMETRY_ENVIRONMENT;
  const release = env.TELEMETRY_RELEASE;
  const enabled =
    env.SERVER_TELEMETRY_ENABLED === "1" &&
    ["development", "test", "staging", "production"].includes(environment ?? "") &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(release ?? "");
  const endpoint = options.endpoint ?? "https://eu.i.posthog.com/i/v0/e/";
  const pending = new Set<AbortController>();
  const counts = { attempted: 0, sent: 0, failed: 0, dropped: 0 };
  let closed = false;
  const report: ReportFailure = (failure) => {
    // No raw Error, request, scope, free-form properties, or user identity crosses this boundary.
    if (typeof failure !== "string" || !Object.hasOwn(failures, failure)) return;
    if (!enabled || closed || pending.size >= 8) {
      counts.dropped++;
      return;
    }
    const controller = new AbortController();
    pending.add(controller);
    counts.attempted++;
    const timer = setTimeout(() => controller.abort(), 2000);
    timer.unref();
    const event = failures[failure];
    const properties = {
      distinct_id: `service:${service}:${environment}`,
      $process_person_profile: false,
      service,
      environment,
      release,
      failure,
      ...(event === "$exception"
        ? {
            $exception_list: [
              {
                type: "ServiceFailure",
                value: failure,
                mechanism: { type: "generic", handled: true, synthetic: true },
              },
            ],
          }
        : {}),
    };
    // Start outside the caller's stack; even a synchronous transport failure cannot escape.
    void Promise.resolve()
      .then(async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ api_key: projectToken, event, properties }),
          signal: controller.signal,
          redirect: "error",
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error("Telemetry delivery denied");
        counts.sent++;
      })
      .catch(() => {
        counts.failed++;
      })
      .finally(() => {
        clearTimeout(timer);
        pending.delete(controller);
      });
  };
  return {
    report,
    counts: () => ({ ...counts }),
    close() {
      closed = true;
      for (const controller of pending) controller.abort();
    },
  };
};
