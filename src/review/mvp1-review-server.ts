import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createInitialReviewState,
  runReviewScenario,
  type ReviewScenarioId,
  type ReviewState
} from "./mvp1-review-scenarios.js";

type ReviewRequestHandler = (request: Request) => Promise<Response>;

export interface ReviewPersistence {
  initialize(state: ReviewState): Promise<ReviewState>;
  persist(state: ReviewState): Promise<ReviewState>;
  summarize(state: ReviewState): Promise<ReviewState>;
}

interface ReviewHandlerOptions {
  persistence?: ReviewPersistence;
}

const DEFAULT_PORT = 4173;
const compiledPublicDir = fileURLToPath(new URL("./public", import.meta.url));
const sourcePublicDir = join(process.cwd(), "src", "review", "public");
const PUBLIC_DIR = existsSync(join(compiledPublicDir, "mvp1-review.html"))
  ? compiledPublicDir
  : sourcePublicDir;
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

export function createReviewRequestHandler(
  initialState = createInitialReviewState(),
  options: ReviewHandlerOptions = {}
): ReviewRequestHandler {
  let state: ReviewState = initialState;
  let initialized = false;

  async function ensureInitialized() {
    if (!initialized) {
      initialized = true;
      state = options.persistence ? await options.persistence.initialize(state) : state;
    }
  }

  return async (request: Request) => {
    await ensureInitialized();
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/review/state") {
      state = options.persistence ? await options.persistence.summarize(state) : state;
      return jsonResponse(state);
    }

    if (request.method === "POST" && url.pathname === "/api/review/reset") {
      state = createInitialReviewState();
      initialized = false;
      await ensureInitialized();
      return jsonResponse({ ok: true, state });
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/review/scenarios/")) {
      const scenarioId = url.pathname.split("/").at(-1) as ReviewScenarioId;
      try {
        const result = runReviewScenario(state, scenarioId);
        state = options.persistence ? await options.persistence.persist(result.state) : result.state;
        return jsonResponse({ ...result, state });
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            error: "REVIEW_SCENARIO_FAILED",
            message: error instanceof Error ? error.message : "검수 시나리오 실행에 실패했습니다.",
            state
          },
          400
        );
      }
    }

    if (request.method === "GET") {
      return staticResponse(url.pathname);
    }

    return jsonResponse({ ok: false, error: "NOT_FOUND", message: "요청 경로를 찾을 수 없습니다." }, 404);
  };
}

export function startMvp1ReviewServer(
  port = Number(process.env.PORT ?? DEFAULT_PORT),
  options: ReviewHandlerOptions = {}
) {
  const handler = createReviewRequestHandler(createInitialReviewState(), options);
  const server = createServer((request, response) => {
    void handleNodeRequest(handler, request, response);
  });

  server.listen(port, () => {
    console.log(`MVP1 review server: http://localhost:${port}`);
  });

  return server;
}

async function handleNodeRequest(
  handler: ReviewRequestHandler,
  request: IncomingMessage,
  response: ServerResponse
) {
  const webRequest = new Request(`http://localhost${request.url ?? "/"}`, {
    method: request.method,
    headers: request.headers as HeadersInit
  });
  const webResponse = await handler(webRequest);
  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function staticResponse(pathname: string) {
  const relativePath = pathname === "/" ? "mvp1-review.html" : pathname.replace(/^\/+/, "");
  const filePath = join(PUBLIC_DIR, relativePath);

  if (!existsSync(filePath)) {
    return jsonResponse({ ok: false, error: "NOT_FOUND", message: "정적 파일을 찾을 수 없습니다." }, 404);
  }

  const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  return new Response(createReadStream(filePath) as unknown as BodyInit, {
    headers: { "content-type": contentType }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startMvp1ReviewServer();
}
