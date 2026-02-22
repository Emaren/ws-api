import type { Server } from "node:http";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { logEvent } from "./shared/logger.js";

try {
  const env = loadEnv();
  const app = createApp(env);

  process.on("unhandledRejection", (reason) => {
    logEvent("error", env.logLevel, "unhandled_rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("uncaughtException", (error) => {
    logEvent("error", env.logLevel, "uncaught_exception", {
      message: error.message,
      stack: error.stack,
    });
  });

  const server = app.listen(env.port, env.bindHost, () => {
    logEvent("info", env.logLevel, "server_started", {
      service: env.serviceName,
      host: env.bindHost,
      port: env.port,
      nodeEnv: env.nodeEnv,
      corsOrigins: env.corsOrigins,
    });
  }) as Server;

  // --- graceful shutdown (systemd-friendly) ---
  let shuttingDown = false;

  const shutdown = (signal: "SIGINT" | "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;

    logEvent("info", env.logLevel, "shutdown_initiated", {
      service: env.serviceName,
      signal,
    });

    // Safety net: if close hangs, exit anyway so systemd doesn't SIGKILL us.
    const force = setTimeout(() => {
      logEvent("warn", env.logLevel, "shutdown_forced_exit", {
        service: env.serviceName,
        afterMs: 5000,
      });
      process.exit(0);
    }, 5000);
    // @ts-expect-error unref exists on Node timers
    force.unref?.();

    server.close((err) => {
      if (err) {
        logEvent("error", env.logLevel, "shutdown_close_error", {
          service: env.serviceName,
          message: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }

      logEvent("info", env.logLevel, "shutdown_complete", {
        service: env.serviceName,
      });
      process.exit(0);
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  // --- end graceful shutdown ---
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      event: "startup_failed",
      message,
    }),
  );
  process.exit(1);
}