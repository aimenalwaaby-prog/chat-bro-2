import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (ENV.allowedOrigins.length === 0 || ENV.allowedOrigins.includes(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use((req, res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const current = requestCounts.get(key);
    if (!current || current.resetAt <= now) requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
    else if (current.count++ > 120) {
      res.status(429).json({ ok: false, error: "تم تجاوز معدل الطلبات. حاول بعد دقيقة." });
      return;
    }
    next();
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  const health = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      ok: true,
      timestamp: Date.now(),
      service: "chatbro-api",
      capabilities: {
        builtInLLM: Boolean(ENV.forgeApiKey),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        cloudflare: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && (process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY)),
        forgeImages: Boolean(process.env.BUILT_IN_FORGE_API_KEY && process.env.BUILT_IN_FORGE_API_URL),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        gateway: Boolean(process.env.MODEL_GATEWAY_BASE_URL || process.env.MODEL_GATEWAYS_JSON),
        pollinations: Boolean(process.env.POLLINATIONS_API_KEY),
        comfyui: Boolean(process.env.COMFYUI_BASE_URL),
      },
    });
  };
  app.get("/health", health);
  app.get("/api/health", health);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Return JSON for unexpected routes so mobile clients never receive an HTML error page.
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: "المسار غير موجود" });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] unhandled request error:", error);
    if (res.headersSent) return;
    res.status(500).json({ ok: false, error: "حدث خطأ في الخادم. حاول مرة أخرى لاحقًا." });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
