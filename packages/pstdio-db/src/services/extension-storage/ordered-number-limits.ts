import { type OrderedRecord, orderedBody } from "pstdio-sync/records";
import { assertStorageLimits, isStorageLimitError, type StorageLimitError } from "pstdio-sync-contracts";
import { orderedNumber } from "./ordered-number-values";

export interface OrderedNumberRepair {
  before: OrderedRecord;
  after: OrderedRecord;
}

export class OrderedNumberLimitError extends Error {
  constructor(
    readonly resourceIds: string[],
    readonly cause: StorageLimitError,
  ) {
    super(cause.message);
    this.name = "OrderedNumberLimitError";
  }
}

const claim = (record: OrderedRecord) => {
  const number = orderedNumber(record);
  return number && JSON.stringify([number.extensionId, number.kind, number.prefix, number.value]);
};

/** Only claimants of the repaired number caused this collateral write. */
export const numberRepairContributors = (input: OrderedRecord[], repairs: OrderedNumberRepair[]) => {
  const claims = new Set(repairs.map(({ before }) => claim(before)).filter(Boolean));
  return [
    ...new Set([
      ...repairs.map(({ before }) => before.recordId),
      ...input.filter((record) => claims.has(claim(record))).map((record) => record.recordId),
    ]),
  ];
};

/** Independent latest-state records have no shared group budget; a repaired author group does. */
export const assertOrderedNumberLimits = (
  records: OrderedRecord[],
  input: OrderedRecord[],
  repairs: OrderedNumberRepair[],
  group: boolean,
) => {
  const materialized = records.map((record) => ({
    recordId: record.recordId,
    deleted: record.deleted,
    ...orderedBody(record),
  }));
  try {
    if (group) assertStorageLimits(materialized);
    else for (const record of materialized) assertStorageLimits([record]);
  } catch (error) {
    if (!isStorageLimitError(error)) throw error;
    const related = error.data.recordId
      ? repairs.filter(({ after }) => after.recordId === error.data.recordId)
      : repairs;
    throw new OrderedNumberLimitError(
      [
        ...new Set([
          ...numberRepairContributors(input, related),
          ...(error.data.recordId ? [error.data.recordId] : []),
        ]),
      ],
      error,
    );
  }
};
