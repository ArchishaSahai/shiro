import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { GITHUB_REPO_URL } from "@/lib/site";

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: GITHUB_REPO_URL,
    nav: {
      title: "Shiro",
    },
  };
}
