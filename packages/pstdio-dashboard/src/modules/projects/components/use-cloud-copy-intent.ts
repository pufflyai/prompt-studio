import { useState } from "react";

export type DownloadOwner = { scope: string; requested: boolean; retired?: boolean };

export const useCloudCopyIntent = (scope: string, accountKnown: boolean) => {
  const [owner, setOwner] = useState<DownloadOwner>({ scope, requested: false });
  // A missing account read can still have a removal receipt for the last confirmed copy.
  if (accountKnown && owner.scope !== scope) setOwner({ scope, requested: false });
  return {
    owner,
    scope: accountKnown ? scope : owner.scope,
    requested: (!accountKnown || owner.scope === scope) && owner.requested,
    rememberIntent(previous: DownloadOwner, admitted: DownloadOwner) {
      setOwner((current) => (current === previous ? admitted : current));
    },
    discardIntent(admitted: DownloadOwner) {
      setOwner((current) => (current === admitted ? { ...current, requested: false, retired: true } : current));
    },
    retireIntent(retiredScope: string) {
      setOwner((current) =>
        current.scope === retiredScope ? { scope: retiredScope, requested: false, retired: true } : current,
      );
    },
  };
};
