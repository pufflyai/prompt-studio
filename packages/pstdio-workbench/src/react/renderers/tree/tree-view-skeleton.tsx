import { Skeleton, Stack } from "@chakra-ui/react";

const TREE_SKELETON_WIDTHS = ["70%", "50%", "82%", "60%", "44%", "76%"];

interface TreeViewSkeletonProps {
  rows?: number;
  /** Announces the placeholder while loading; without it the rows are decorative. */
  label?: string;
}

/** Placeholder rows while navigation entries load. */
export const TreeViewSkeleton = (props: TreeViewSkeletonProps) => {
  const { rows = TREE_SKELETON_WIDTHS.length, label } = props;
  return (
    <Stack gap="sm" px="sm" py="xs" {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}>
      {TREE_SKELETON_WIDTHS.slice(0, rows).map((width, index) => (
        <Skeleton variant="none" key={`${width}-${index}`} height="4" width={width} borderRadius="xs" />
      ))}
    </Stack>
  );
};
