import { Box, Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ResizableSplitLayout, Tooltip, TreeList } from "@pstdio/ui";
import { FileText, PanelLeftClose } from "lucide-react";
import { BLOG_POSTS } from "./content/blog";
import { DocView } from "./doc-view";

interface BlogViewProps {
  activePostId?: string;
  postListOpen: boolean;
  onPostListOpenChange: (open: boolean) => void;
  onSelectPost: (postId: string) => void;
}

interface PostListProps {
  activePostId: string;
  onClose: () => void;
  onSelectPost: (postId: string) => void;
}

const PostList = (props: PostListProps) => {
  const { activePostId, onClose, onSelectPost } = props;

  return (
    <Stack width="full" height="full" gap="0" py="8px" bg="bg.subtle" overflowY="auto">
      <HStack height="28px" px="10px" justify="space-between">
        <Text textStyle="label/XS" textTransform="uppercase" color="fg.muted" letterSpacing="0.08em">
          Posts
        </Text>
        <Tooltip content="Close post list">
          <IconButton aria-label="Close post list" variant="ghost" size="2xs" onClick={onClose}>
            <PanelLeftClose size={14} />
          </IconButton>
        </Tooltip>
      </HStack>
      <TreeList
        sections={[
          {
            id: "posts",
            nodes: BLOG_POSTS.map((post) => ({
              id: post.id,
              label: post.title,
              endContent: (
                <Text fontFamily="mono" fontSize="10px" whiteSpace="nowrap">
                  {post.date}
                </Text>
              ),
              icon: <FileText size={14} />,
              isNavigable: true,
            })),
          },
        ]}
        rowVariant="compact"
        activeNodeId={activePostId}
        onNavigate={(event) => onSelectPost(event.nodeId)}
      />
    </Stack>
  );
};

const PostContent = (props: { page: (typeof BLOG_POSTS)[number]["page"] }) => {
  const { page } = props;

  return (
    <Box width="full" height="full" minWidth="0" overflowY="auto">
      <Flex justify="center">
        <DocView page={page} />
      </Flex>
    </Box>
  );
};

export const BlogView = (props: BlogViewProps) => {
  const { activePostId = BLOG_POSTS[0].id, postListOpen, onPostListOpenChange, onSelectPost } = props;
  const activePost = BLOG_POSTS.find((post) => post.id === activePostId) ?? BLOG_POSTS[0];

  return (
    <Box height="full">
      <Box height="full" display={{ base: "none", md: "block" }}>
        <ResizableSplitLayout
          collapsed={!postListOpen}
          defaultSizePx={264}
          minSizePx={220}
          maxSizePx={420}
          contentMinSizePx={320}
          resizeLabel="Resize post list"
          showResizeSeparator
          onCollapsedChange={(collapsed) => onPostListOpenChange(!collapsed)}
          resizablePanel={
            <PostList
              activePostId={activePostId}
              onClose={() => onPostListOpenChange(false)}
              onSelectPost={onSelectPost}
            />
          }
          contentPanel={<PostContent page={activePost.page} />}
        />
      </Box>
      <Box height="full" display={{ base: "block", md: "none" }}>
        <PostContent page={activePost.page} />
      </Box>
    </Box>
  );
};
