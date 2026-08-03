"use client";

import type { ElementType, ReactNode } from "react";

type HeadingTag = "h2" | "h3" | "h4";

export function DocsHeading({
  as,
  children,
  id,
}: {
  readonly as: HeadingTag;
  readonly children?: ReactNode;
  readonly id?: string | undefined;
}) {
  const Tag = as as ElementType;

  return (
    <Tag className="docs-heading" id={id}>
      <span>{children}</span>
      {id ? (
        <a
          aria-label="Copy link to section"
          className="docs-heading-anchor"
          href={`#${id}`}
          onClick={() => {
            void copyText(`${window.location.origin}${window.location.pathname}#${id}`);
          }}
        >
          #
        </a>
      ) : null}
    </Tag>
  );
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !("clipboard" in navigator)) {
    return;
  }

  await navigator.clipboard.writeText(text).catch(() => undefined);
}
