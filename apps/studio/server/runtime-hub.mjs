#!/usr/bin/env node
/**
 * Local Studio runtime hub.
 * Relays WebSocket messages between Studio UI clients and SDK agents.
 * Replaceable later with a remote cloud transport without changing the UI.
 */

import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const port = Number(process.env.SHIRO_STUDIO_RUNTIME_PORT ?? process.env.RUNTIME_PORT ?? 4317);

/** @typedef {{ role: "studio" | "agent", agentName?: string }} ClientMeta */

/** @type {Map<WebSocket, ClientMeta>} */
const clients = new Map();

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      service: "shiro-studio-runtime",
      agents: countRole("agent"),
      studios: countRole("studio"),
    })
  );
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  clients.set(socket, { role: "studio" });

  socket.on("message", (data) => {
    let parsed;
    try {
      parsed = JSON.parse(String(data));
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return;
    }

    if (parsed.type === "hello") {
      const role = parsed.role === "agent" ? "agent" : "studio";
      clients.set(socket, {
        role,
        ...(typeof parsed.agentName === "string" ? { agentName: parsed.agentName } : {}),
      });
      broadcastStatus();
      return;
    }

    if (parsed.type === "event") {
      // Agent → all Studio UIs
      for (const [peer, meta] of clients) {
        if (peer !== socket && meta.role === "studio" && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(parsed));
        }
      }
      return;
    }

    if (parsed.type === "execute") {
      // Studio → first connected agent (fan-out to all agents if multiple)
      const agents = [...clients.entries()].filter(
        ([peer, meta]) => meta.role === "agent" && peer.readyState === WebSocket.OPEN
      );
      if (agents.length === 0) {
        socket.send(
          JSON.stringify({
            type: "execute.result",
            requestId: parsed.requestId,
            ok: false,
            error: "No agent connected. Start your agent with SHIRO_STUDIO_URL set.",
          })
        );
        return;
      }
      for (const [agent] of agents) {
        agent.send(JSON.stringify(parsed));
      }
      return;
    }

    if (parsed.type === "execute.result") {
      for (const [peer, meta] of clients) {
        if (peer !== socket && meta.role === "studio" && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(parsed));
        }
      }
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    broadcastStatus();
  });

  socket.send(
    JSON.stringify({
      type: "status",
      mode: countRole("agent") > 0 ? "live" : "demo",
      agents: countRole("agent"),
    })
  );
});

function countRole(role) {
  let count = 0;
  for (const meta of clients.values()) {
    if (meta.role === role) count += 1;
  }
  return count;
}

function broadcastStatus() {
  const payload = JSON.stringify({
    type: "status",
    mode: countRole("agent") > 0 ? "live" : "demo",
    agents: countRole("agent"),
  });
  for (const [peer, meta] of clients) {
    if (meta.role === "studio" && peer.readyState === WebSocket.OPEN) {
      peer.send(payload);
    }
  }
}

server.listen(port, "127.0.0.1", () => {
  console.log(`[shiro-runtime] hub listening on ws://127.0.0.1:${String(port)}`);
});
