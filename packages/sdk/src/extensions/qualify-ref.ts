import type { ContributionKind, ContributionRef, PageSlotRef } from "pstdio-api-contracts/extension-kernel";

type QualifiableRef = ContributionRef<ContributionKind> | PageSlotRef;
export type QualifiedRef<Ref extends QualifiableRef> = Ref extends PageSlotRef
  ? Omit<Ref, "page"> & { readonly page: QualifiedRef<Ref["page"]> }
  : Ref & { readonly extensionId: string };

/** Publish a provider-owned reference without changing the local contribution definition. */
export function qualifyRef<Ref extends QualifiableRef>(owner: string, ref: Ref): QualifiedRef<Ref>;
export function qualifyRef(owner: string, ref: QualifiableRef) {
  if (ref.kind === "page-slot") return { ...ref, page: qualifyRef(owner, ref.page) };
  return { ...ref, extensionId: owner };
}
