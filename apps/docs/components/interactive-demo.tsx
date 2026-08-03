"use client";

import { motion } from "framer-motion";
import { Check, CopyCheck, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { TerminalReplay, type TerminalLine } from "@/components/terminal-replay";

const examples = [
  {
    label: "Agent Run",
    code: `import { Agent, Engine, tool } from "@shiro/core";
import { openai } from "@shiro/openai";

const deploy = tool({
  name: "deploy",
  requiresApproval: true,
  execute: async ({ target }) => ({ target, status: "queued" }),
});

const agent = new Agent({
  name: "release-manager",
  provider: openai({ model: "gpt-5" }),
  tools: [deploy],
});

await new Engine().run(agent, "Ship the canary build.");`,
    output: "Run paused. Waiting for deploy approval.",
    status: "WAITING",
    trace: [
      { kind: "pink", text: "run.started release-manager" },
      { kind: "event", text: "provider.call gpt-5" },
      { kind: "warning", text: "approval.deploy requested" },
      { kind: "success", text: "studio.trace opened" },
    ],
  },
  {
    label: "Tracing",
    code: `const result = await engine.run(agent, input, {
  sessionId: "incident_7421",
});

await result.trace.export({
  destination: "studio",
  include: ["model", "tool", "handoff", "approval"],
});`,
    output: "Trace exported with provider, tool, handoff, and approval spans.",
    status: "SYNCED",
    trace: [
      { kind: "pink", text: "trace.open incident_7421" },
      { kind: "event", text: "span.provider recorded" },
      { kind: "event", text: "span.tool recorded" },
      { kind: "success", text: "trace.export studio" },
    ],
  },
  {
    label: "Studio",
    code: `import { Studio } from "@shiro/studio";

const studio = new Studio({
  project: "support-agents",
});

studio.attach(engine);
studio.stream(run.trace);`,
    output: "Studio is receiving run events from the engine.",
    status: "LIVE",
    trace: [
      { kind: "pink", text: "studio.connected" },
      { kind: "event", text: "timeline.stream opened" },
      { kind: "purple", text: "graph.nodes updated" },
      { kind: "success", text: "approval queue ready" },
    ],
  },
] as const;

export function InteractiveDemo() {
  const [active, setActive] = useState<(typeof examples)[number]["label"]>(examples[0].label);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const example = useMemo(
    () => examples.find((item) => item.label === active) ?? examples[0],
    [active]
  );

  return (
    <motion.section
      className="mx-auto max-w-[1320px] px-5 py-18"
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#ff4fd8]">
          Build, run, inspect
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Build the run. Watch it execute.
        </h2>
        <p className="mt-4 text-base leading-7 text-white/52">
          The example on the left creates the run. The panels on the right show the state Shiro
          emits while it executes.
        </p>
      </div>

      <div className="mt-10 rounded-[1.75rem] border border-white/[.10] bg-[#0D0D11] p-5 shadow-[0_0_0_1px_rgba(255,255,255,.025),0_28px_100px_rgba(255,79,216,.12),0_20px_70px_rgba(0,0,0,.34)]">
        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {examples.map((item) => (
            <button
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                active === item.label
                  ? "border-white/[.18] bg-white/[.10] text-white"
                  : "border-transparent bg-white/[.06] text-white/45 hover:text-white"
              }`}
              key={item.label}
              onClick={() => {
                setActive(item.label);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <motion.div
            className="terminal-frame group overflow-hidden rounded-[18px] border border-[#2a2a2a] bg-[#09090B] shadow-[0_18px_48px_rgba(0,0,0,.40),0_0_42px_rgba(255,79,216,.09)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(0,0,0,.44),0_0_58px_rgba(255,79,216,.13)]"
            key={example.label}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.34 }}
          >
            <div className="relative flex h-10 items-center border-b border-white/[.065] bg-[#0D0D10] px-4 pr-44">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="truncate font-mono text-[11px] font-medium text-white/42">
                  shiro-example.ts
                </span>
              </div>
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <span className="hidden rounded-md border border-white/[.07] bg-white/[.03] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-white/38 sm:inline-flex">
                  TypeScript
                </span>
                <button
                  aria-label="Run example"
                  className="terminal-action terminal-action-run"
                  onClick={() => {
                    setRunning(true);
                    window.setTimeout(() => {
                      setRunning(false);
                    }, 1500);
                  }}
                  type="button"
                >
                  <Play
                    aria-hidden="true"
                    className={running ? "h-3.5 w-3.5 animate-pulse text-[#ff2bd6]" : "h-3.5 w-3.5"}
                  />
                </button>
                <button
                  aria-label="Copy code"
                  className="terminal-action terminal-copy-action"
                  onClick={() => {
                    void copyText(example.code);
                    setCopied(true);
                    window.setTimeout(() => {
                      setCopied(false);
                    }, 1400);
                  }}
                  type="button"
                >
                  {copied ? (
                    <>
                      <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#ff7adf]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <CopyCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre className="min-h-[410px] overflow-x-auto px-7 py-7 font-mono text-[13.5px] leading-[1.9] sm:px-9">
              <code>
                {example.code.split("\n").map((line, index) => (
                  <motion.span
                    animate={
                      running && index >= 5 && index <= 13 ? { color: "rgba(255,255,255,.92)" } : {}
                    }
                    className="block text-white/72"
                    key={`${line}-${String(index)}`}
                  >
                    <span className="mr-5 inline-block w-6 select-none text-right text-white/22">
                      {index + 1}
                    </span>
                    <SyntaxLine line={line} />
                  </motion.span>
                ))}
              </code>
            </pre>
          </motion.div>

          <div className="grid gap-5">
            <div className="rounded-[1.25rem] border border-white/[.10] bg-[#111115] shadow-[0_18px_60px_rgba(0,0,0,.32)]">
              <div className="flex items-center justify-between border-b border-white/[.09] px-4 py-3">
                <div className="flex items-center gap-3 font-mono text-sm text-white/56">
                  <span className="h-2 w-2 rounded-full bg-[#ff4fd8]" />
                  Run state
                </div>
                <span className="rounded-md border border-white/[.10] bg-white/[.04] px-2.5 py-1 font-mono text-xs text-white/56">
                  {example.status}
                </span>
              </div>
              <div className="p-4">
                <div className="rounded-xl border border-white/[.10] bg-white/[.045] px-4 py-3 text-sm text-white/72">
                  Input: ship a canary build with a required approval.
                </div>
                <div className="mt-4 rounded-xl border border-white/[.07] bg-[#09090B] p-4">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-white/70">shiro / agent</span>
                    <span className="text-white/42">model: gpt-5</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/76">{example.output}</p>
                </div>
              </div>
            </div>
            <TerminalReplay
              lines={example.trace satisfies readonly TerminalLine[]}
              title={`${example.label.toLowerCase()} trace`}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function SyntaxLine({ line }: { readonly line: string }) {
  if (line.trim().startsWith("import")) {
    return <span className="text-white/86">{line}</span>;
  }
  if (line.includes("@shiro") || line.includes("gpt-5") || line.includes("studio")) {
    return <span className="text-white/72">{line}</span>;
  }
  if (
    line.includes("tool") ||
    line.includes("Agent") ||
    line.includes("Engine") ||
    line.includes("Studio")
  ) {
    return <span className="text-white">{line}</span>;
  }
  if (
    line.includes("requiresApproval") ||
    line.includes("destination") ||
    line.includes("sessionId")
  ) {
    return <span className="text-[#ff7adf]">{line}</span>;
  }
  return <span>{line}</span>;
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !("clipboard" in navigator)) {
    return;
  }

  await navigator.clipboard.writeText(text).catch(() => undefined);
}
