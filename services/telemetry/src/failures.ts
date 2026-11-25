export const serviceFailures = {
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
  project_deletion_handoff_failed: "service_operation_failed",
  sync_cleanup_failed: "service_operation_failed",
  asset_operation_failed: "service_operation_failed",
} as const;
export type ServiceFailure = keyof typeof serviceFailures;
