import type { HeadFC } from "gatsby";
import { MarkdownPage } from "@/components/markdown-page";
import { SEO } from "@/components/seo";
import content from "@/content/privacy-policy.md";

const PrivacyPolicyPage = () => <MarkdownPage content={content} />;

export default PrivacyPolicyPage;

export const Head: HeadFC = () => <SEO title="Privacy Policy" />;
