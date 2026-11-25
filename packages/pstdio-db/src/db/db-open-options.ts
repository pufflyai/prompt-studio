import type { LegacyConversionFailure } from "./legacy-record-upgrade";
import type { PgliteRetirementPhase } from "./pglite-current-home";
import type { DatabaseMaintenancePhase } from "./startup-maintenance";

// Startup steps in order. The runtime publishes itself once the database is locked and logs every step.
export type DbOpenPhase =
  | PgliteRetirementPhase
  | DatabaseMaintenancePhase
  | "database_locked"
  | "database_engine_loaded"
  | "database_image_restored"
  | "database_opened"
  | "database_migrated"
  | "database_index_nodes";

export interface DbOpenOptions {
  path?: string;
  onPhase?: (phase: DbOpenPhase) => void;
  signal?: AbortSignal;
  /** Folder for encrypted index nodes; defaults to a sibling of the database folder. */
  indexNodesPath?: string;
  onLegacyConversionError?: (failure: LegacyConversionFailure) => void;
  /** The runtime vacuums in the background and schedules deletion of retired rows. */
  deferCleanup?: boolean;
}
