import { HStack, Skeleton, Stack } from "@chakra-ui/react";

export const SettingsContentSkeleton = () => (
  <Stack role="status" aria-label="Loading settings" gap="lg" px="sm">
    {[2, 3].map((rows, group) => (
      <Stack key={group} gap="md" aria-hidden="true">
        <Skeleton variant="none" h="4" w="32" borderRadius="xs" />
        {Array.from({ length: rows }, (_, row) => (
          <HStack key={row} justify="space-between" gap="md" py="xs">
            <Skeleton variant="none" h="4" w={row % 2 === 0 ? "48" : "36"} maxW="full" borderRadius="xs" />
            <Skeleton variant="none" h="8" w="28" flexShrink="0" borderRadius="xs" />
          </HStack>
        ))}
      </Stack>
    ))}
  </Stack>
);

export const SettingsNavigationSkeleton = () => (
  <Stack role="status" aria-label="Loading navigation" gap="lg" px="sm" py="xs">
    {[3, 2, 3, 1].map((rows, group) => (
      <Stack key={group} gap="sm" aria-hidden="true">
        <Skeleton variant="none" h="3" w="24" borderRadius="xs" />
        {Array.from({ length: rows }, (_, row) => (
          <HStack key={row} gap="sm" py="2xs">
            <Skeleton variant="none" boxSize="4" flexShrink="0" borderRadius="xs" />
            <Skeleton variant="none" h="4" w={row % 2 === 0 ? "36" : "28"} maxW="full" borderRadius="xs" />
          </HStack>
        ))}
      </Stack>
    ))}
  </Stack>
);
