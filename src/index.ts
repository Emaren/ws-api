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

  app.listen(env.port, env.bindHost, () => {
    logEvent("info", env.logLevel, "server_started", {
      service: env.serviceName,
      host: env.bindHost,
      port: env.port,
      nodeEnv: env.nodeEnv,
      corsOrigins: env.corsOrigins,
    });
  });
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