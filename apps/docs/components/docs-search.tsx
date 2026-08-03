"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface SearchSegment {
  readonly content: string;
  readonly styles?: {
    readonly highlight?: boolean;
  };
}

interface SearchResult {
  readonly breadcrumbs?: readonly string[];
  readonly content: string;
  readonly contentWithHighlights?: readonly SearchSegment[];
  readonly id: string;
  readonly type: "page" | "heading" | "text";
  readonly url: string;
}

export function DocsSearch({
  enableShortcut = false,
  variant = "top",
}: {
  readonly enableShortcut?: boolean;
  readonly variant?: "sidebar" | "top";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!enableShortcut) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [enableShortcut]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const value = window.localStorage.getItem("shiro-recent-searches");
    setRecent(value ? (JSON.parse(value) as string[]) : []);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    const id = window.setTimeout(() => {
      void fetch(`/api/search?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<SearchResult[]>)
        .then((items) => {
          setResults(items.slice(0, 12));
          setActiveIndex(0);
        })
        .catch(() => undefined);
    }, 90);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const visibleRecent = useMemo(
    () => recent.filter((item) => item.includes(query)).slice(0, 5),
    [query, recent]
  );
  const activeResult = results[activeIndex];

  function openResult(result: SearchResult) {
    const nextRecent = [query.trim(), ...recent.filter((item) => item !== query.trim())]
      .filter(Boolean)
      .slice(0, 6);
    window.localStorage.setItem("shiro-recent-searches", JSON.stringify(nextRecent));
    setRecent(nextRecent);
    setOpen(false);
    setQuery("");
    router.push(result.url);
  }

  return (
    <>
      <button
        className={variant === "top" ? "docs-search-button" : "docs-sidebar-search"}
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        <span>{variant === "top" ? "Search" : "Search docs"}</span>
        <kbd>{variant === "top" ? "Ctrl K" : "⌘K"}</kbd>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="docs-search-overlay"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="docs-search-dialog"
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div className="docs-search-input-row">
                <Search aria-hidden="true" className="h-4 w-4" />
                <input
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex((index) =>
                        Math.min(index + 1, Math.max(0, results.length - 1))
                      );
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex((index) => Math.max(0, index - 1));
                    }
                    if (event.key === "Enter" && activeResult) {
                      event.preventDefault();
                      openResult(activeResult);
                    }
                  }}
                  placeholder="Search pages, headings, and examples..."
                  ref={inputRef}
                  value={query}
                />
                <button
                  aria-label="Close search"
                  onClick={() => {
                    setOpen(false);
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <div className="docs-search-results">
                {query.trim() ? (
                  results.length ? (
                    results.map((result, index) => (
                      <button
                        className={index === activeIndex ? "active" : undefined}
                        key={result.id}
                        onMouseEnter={() => {
                          setActiveIndex(index);
                        }}
                        onClick={() => {
                          openResult(result);
                        }}
                        type="button"
                      >
                        <span className="docs-search-result-type">{result.type}</span>
                        <span className="docs-search-result-title">
                          {(result.contentWithHighlights ?? [{ content: result.content }]).map(
                            (segment, segmentIndex) => (
                              <mark
                                className={segment.styles?.highlight ? "highlight" : undefined}
                                key={`${result.id}-${String(segmentIndex)}`}
                              >
                                {segment.content}
                              </mark>
                            )
                          )}
                        </span>
                        {result.breadcrumbs?.length ? (
                          <span className="docs-search-result-path">
                            {result.breadcrumbs.join(" / ")}
                          </span>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <div className="docs-search-empty">
                      <p>No results</p>
                      <span>Try a concept like engine, tracing, approvals, memory, or Studio.</span>
                    </div>
                  )
                ) : (
                  <div className="docs-search-empty">
                    <p>Recent searches</p>
                    {visibleRecent.length ? (
                      visibleRecent.map((item) => (
                        <button
                          key={item}
                          onClick={() => {
                            setQuery(item);
                          }}
                          type="button"
                        >
                          {item}
                        </button>
                      ))
                    ) : (
                      <span>Start typing to search pages and headings.</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
