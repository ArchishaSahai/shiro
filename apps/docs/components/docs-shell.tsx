"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { DocsSearch } from "@/components/docs-search";

interface TocItem {
  readonly depth?: number;
  readonly title?: ReactNode;
  readonly url?: string;
}

interface NavItem {
  readonly href: string;
  readonly label: string;
}

interface NavGroup {
  readonly items: readonly NavItem[];
  readonly label: string;
}

const navGroups: readonly NavGroup[] = [
  {
    label: "Start",
    items: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/quick-start", label: "Quick Start" },
    ],
  },
  {
    label: "Core",
    items: [
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/core-concepts", label: "Core Concepts" },
      { href: "/docs/agents", label: "Agents" },
      { href: "/docs/engine", label: "Engine" },
      { href: "/docs/runner", label: "Runner" },
      { href: "/docs/execution-pipeline", label: "Execution Pipeline" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { href: "/docs/providers", label: "Providers" },
      { href: "/docs/plugins", label: "Plugins" },
      { href: "/docs/tools", label: "Tools" },
      { href: "/docs/multi-agent", label: "Multi-Agent" },
      { href: "/docs/human-in-the-loop", label: "Human-in-the-loop" },
      { href: "/docs/memory-sessions", label: "Memory Sessions" },
      { href: "/docs/structured-outputs", label: "Structured Outputs" },
      { href: "/docs/tracing", label: "Tracing" },
      { href: "/docs/streaming", label: "Streaming" },
      { href: "/docs/studio", label: "Studio" },
      { href: "/docs/reliability", label: "Reliability" },
      { href: "/docs/error-handling", label: "Error Handling" },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "/docs/examples", label: "Examples" },
      { href: "/docs/cli", label: "CLI" },
      { href: "/docs/api-reference", label: "API Reference" },
      { href: "/docs/migration", label: "Migration" },
      { href: "/docs/faq", label: "FAQ" },
      { href: "/docs/contributing", label: "Contributing" },
      { href: "/docs/roadmap", label: "Roadmap" },
    ],
  },
] as const;

export function DocsShell({
  children,
  description,
  title,
  toc,
}: {
  readonly children: ReactNode;
  readonly description?: string | undefined;
  readonly title: string;
  readonly toc: readonly TocItem[];
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const ids = toc
      .map((item) => item.url?.replace(/^#/, ""))
      .filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: [0, 1] }
    );

    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [toc]);

  const activeGroupLabels = useMemo(
    () =>
      new Set(
        navGroups
          .filter((group) => group.items.some((item) => isActivePath(pathname, item.href)))
          .map((group) => group.label)
      ),
    [pathname]
  );

  return (
    <div className="docs-product-shell">
      <header className="docs-topbar">
        <Link className="docs-logo" href="/">
          Shiro
        </Link>
        <nav aria-label="Main navigation" className="docs-topnav">
          <Link href="/docs">Docs</Link>
          <Link href="/docs/api-reference">API</Link>
          <Link href="/docs/examples">Examples</Link>
          <Link href="https://github.com/shiro-ai/shiro">GitHub</Link>
        </nav>
        <DocsSearch enableShortcut />
        <button
          aria-label="Open navigation"
          className="docs-mobile-menu"
          onClick={() => {
            setDrawerOpen(true);
          }}
          type="button"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      <div className="docs-grid">
        <aside className="docs-sidebar">
          <SidebarNav activeGroupLabels={activeGroupLabels} pathname={pathname} />
        </aside>

        <motion.main
          animate={{ opacity: 1, y: 0 }}
          className="docs-content"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className="docs-title-block">
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          <article className="docs-prose">{children}</article>
        </motion.main>

        <aside className="docs-toc">
          <p>On this page</p>
          <nav aria-label="On this page">
            {toc.map((item, index) => {
              const href = item.url ?? "#";
              const id = href.replace(/^#/, "");
              const active = activeId === id;
              const indent = Math.max(0, (item.depth ?? 2) - 2) * 12 + 12;

              return (
                <a
                  className={active ? "active" : undefined}
                  href={href}
                  key={`${href}-${String(index)}`}
                  style={{ paddingLeft: `${String(indent)}px` }}
                >
                  {item.title}
                </a>
              );
            })}
          </nav>
        </aside>
      </div>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="docs-drawer-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.aside
              animate={{ x: 0 }}
              className="docs-drawer"
              exit={{ x: "-100%" }}
              initial={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="docs-drawer-header">
                <span>Shiro</span>
                <button
                  aria-label="Close navigation"
                  onClick={() => {
                    setDrawerOpen(false);
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <DocsSearch variant="sidebar" />
              <SidebarNav activeGroupLabels={activeGroupLabels} pathname={pathname} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarNav({
  activeGroupLabels,
  pathname,
}: {
  readonly activeGroupLabels: ReadonlySet<string>;
  readonly pathname: string;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(navGroups.map((group) => group.label))
  );

  useEffect(() => {
    setOpenGroups((current) => new Set([...current, ...activeGroupLabels]));
  }, [activeGroupLabels]);

  return (
    <div className="docs-sidebar-inner">
      <DocsSearch variant="sidebar" />
      <nav aria-label="Documentation sections" className="docs-sidebar-nav">
        {navGroups.map((group) => {
          const open = openGroups.has(group.label);

          return (
            <section className="docs-nav-group" key={group.label}>
              <button
                aria-expanded={open}
                className="docs-nav-group-trigger"
                onClick={() => {
                  setOpenGroups((current) => {
                    const next = new Set(current);
                    if (next.has(group.label)) {
                      next.delete(group.label);
                    } else {
                      next.add(group.label);
                    }
                    return next;
                  });
                }}
                type="button"
              >
                <span>{group.label}</span>
                <ChevronDown aria-hidden="true" className={open ? "open h-4 w-4" : "h-4 w-4"} />
              </button>

              <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="docs-nav-items"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {group.items.map((item) => {
                      const active = isActivePath(pathname, item.href);

                      return (
                        <Link
                          className={active ? "active" : undefined}
                          href={item.href}
                          key={item.href}
                        >
                          {active ? (
                            <motion.span className="docs-active-rail" layoutId="docs-active-rail" />
                          ) : null}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          );
        })}
      </nav>
    </div>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/docs") {
    return pathname === "/docs";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
