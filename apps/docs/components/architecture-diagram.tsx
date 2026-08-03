"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  Brain,
  Database,
  Gauge,
  GitBranch,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useState } from "react";

const nodes = [
  {
    body: "Owns registries, plugins, sessions, approval services, and event buses.",
    icon: Gauge,
    id: "engine",
    title: "Engine",
  },
  {
    body: "Executes one run and coordinates state transitions.",
    icon: Activity,
    id: "runner",
    title: "Runner",
  },
  {
    body: "Holds instructions, model defaults, tools, handoffs, and output shape.",
    icon: Bot,
    id: "agents",
    title: "Agents",
  },
  {
    body: "Adapt model APIs behind Shiro's provider contract.",
    icon: Database,
    id: "providers",
    title: "Providers",
  },
  {
    body: "Run typed side effects inside the execution lifecycle.",
    icon: Wrench,
    id: "tools",
    title: "Tools",
  },
  {
    body: "Persist and retrieve run context without mutating agents.",
    icon: Brain,
    id: "memory",
    title: "Memory",
  },
  {
    body: "Pause unsafe actions and record reviewer decisions.",
    icon: ShieldCheck,
    id: "guardrails",
    title: "Guardrails",
  },
  {
    body: "Render traces, timelines, approvals, and run graphs.",
    icon: GitBranch,
    id: "studio",
    title: "Studio",
  },
] as const;

export function ArchitectureDiagram() {
  const [active, setActive] = useState<(typeof nodes)[number]>(nodes[0]);

  return (
    <div className="architecture-diagram">
      <div className="architecture-pipeline">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const selected = active.id === node.id;

          return (
            <div className="architecture-step" key={node.id}>
              {index > 0 ? <span className="architecture-connector" /> : null}
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className={selected ? "active" : undefined}
                initial={{ opacity: 0, y: 10 }}
                onClick={() => {
                  setActive(node);
                }}
                onMouseEnter={() => {
                  setActive(node);
                }}
                transition={{ delay: index * 0.035, duration: 0.24 }}
                type="button"
              >
                <span className="architecture-step-index">{index + 1}</span>
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span>{node.title}</span>
              </motion.button>
            </div>
          );
        })}
      </div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="architecture-detail"
        initial={{ opacity: 0, y: 8 }}
        key={active.id}
      >
        <div>
          <p>{active.title}</p>
          <span>{active.body}</span>
        </div>
        <code>{active.id}.event()</code>
      </motion.div>
    </div>
  );
}
