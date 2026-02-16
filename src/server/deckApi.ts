import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import Ajv2020 from "ajv/dist/2020";

const DECK_FILENAME = "deck.json";
const PROJECT_DIR = "projects";
const TEMPLATES_DIR = "templates";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

// -- Project-aware path helpers --

function projectsRoot(): string {
  return path.resolve(process.cwd(), PROJECT_DIR);
}

function projectDir(project: string): string {
  return path.resolve(projectsRoot(), project);
}

function deckPath(project: string): string {
  return path.resolve(projectDir(project), DECK_FILENAME);
}

function assetsDir(project: string): string {
  return path.resolve(projectDir(project), "assets");
}

function isValidProjectName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function getProjectParam(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  const project = url.searchParams.get("project");
  assert(typeof project === "string" && project.length > 0, "Missing ?project= query parameter");
  assert(isValidProjectName(project), `Invalid project name: ${project}`);
  return project;
}

function loadSchema() {
  const schemaPath = path.resolve(process.cwd(), "src/schema/deck.schema.json");
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true });
  return ajv.compile(loadSchema());
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
  });
}

function readBinaryBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => { chunks.push(chunk); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Vite plugin that exposes API endpoints for deck.json operations.
 *
 * All endpoints (except /api/projects, /api/create-project, /api/delete-project)
 * require a `?project=name` query parameter.
 *
 * Editor endpoints:
 *   GET  /api/load-deck?project=name    — Read deck.json
 *   POST /api/save-deck?project=name    — Write deck.json (full replacement)
 *
 * Project management:
 *   GET  /api/projects          — List projects
 *   POST /api/create-project    — Create a new project
 *   POST /api/delete-project    — Delete a project
 *
 * AI tool endpoints (all require ?project=name):
 *   POST /api/ai/create-deck     — Create a new deck (validates against schema)
 *   POST /api/ai/add-slide       — Add a slide to the deck
 *   POST /api/ai/update-slide    — Update a slide by ID
 *   POST /api/ai/delete-slide    — Delete a slide by ID
 *   POST /api/ai/add-element     — Add an element to a slide
 *   POST /api/ai/update-element  — Update an element within a slide
 *   POST /api/ai/delete-element  — Delete an element from a slide
 *   GET  /api/ai/read-deck       — Read the current deck state
 *   GET  /api/ai/tools           — List available AI tools with schemas
 */
export function deckApiPlugin(): Plugin {
  let validate: ReturnType<typeof createValidator>;
  let viteServer: Parameters<NonNullable<Plugin["configureServer"]>>[0];

  /** Notify the browser that deck.json was modified by an AI tool */
  function notifyDeckChanged(project: string) {
    viteServer.ws.send({
      type: "custom",
      event: "deckode:deck-changed",
      data: { project },
    });
  }

  return {
    name: "deckode-api",
    configureServer(server) {
      viteServer = server;
      validate = createValidator();

      // -- Migrate legacy layouts --
      migrateToProjectDir();

      // -- Static serving: /assets/{project}/* --

      server.middlewares.use("/assets", (req, res, next) => {
        const urlPath = decodeURIComponent(req.url ?? "/");
        // URL format: /assets/{project}/{filename}
        // The urlPath here already has /assets stripped, so it starts with /{project}/{filename}
        const parts = urlPath.replace(/^\//, "").split("/").filter(Boolean);
        if (parts.length < 2) { next(); return; }
        const project = parts[0]!;
        if (!isValidProjectName(project)) { next(); return; }
        const relativeFile = parts.slice(1).join("/");
        const dir = assetsDir(project);
        const filePath = path.resolve(dir, relativeFile);
        if (!filePath.startsWith(dir)) { next(); return; }
        if (!fs.existsSync(filePath)) { next(); return; }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext];
        if (!mime) { next(); return; }
        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(filePath).pipe(res);
      });

      // -- Upload asset --

      server.middlewares.use("/api/upload-asset", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const contentType = req.headers["content-type"] ?? "";
        assert(
          contentType.startsWith("image/") || contentType.startsWith("video/"),
          `Unsupported content type: ${contentType}`,
        );
        const rawFilename = req.headers["x-filename"];
        assert(typeof rawFilename === "string" && rawFilename.length > 0, "Missing X-Filename header");
        const filename = decodeURIComponent(rawFilename);

        const dir = assetsDir(project);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Deduplicate filename
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        let finalName = filename;
        let counter = 0;
        while (fs.existsSync(path.resolve(dir, finalName))) {
          counter++;
          finalName = `${base}-${counter}${ext}`;
        }

        const buffer = await readBinaryBody(req);
        fs.writeFileSync(path.resolve(dir, finalName), buffer);
        jsonResponse(res, 200, { url: `/assets/${project}/${finalName}` });
      });

      // -- Project management endpoints --

      server.middlewares.use("/api/projects", (_req, res) => {
        const root = projectsRoot();
        if (!fs.existsSync(root)) {
          jsonResponse(res, 200, { projects: [] });
          return;
        }
        const entries = fs.readdirSync(root, { withFileTypes: true });
        const projects = entries
          .filter((e) => e.isDirectory() && fs.existsSync(path.resolve(root, e.name, DECK_FILENAME)))
          .map((e) => {
            const dp = path.resolve(root, e.name, DECK_FILENAME);
            const deck = JSON.parse(fs.readFileSync(dp, "utf-8"));
            return {
              name: e.name,
              title: deck.meta?.title ?? e.name,
            };
          });
        jsonResponse(res, 200, { projects });
      });

      server.middlewares.use("/api/create-project", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const body = JSON.parse(await readBody(req));
        const name: string = body.name;
        assert(typeof name === "string" && isValidProjectName(name), `Invalid project name: ${name}`);
        const dir = projectDir(name);
        assert(!fs.existsSync(dir), `Project "${name}" already exists`);

        fs.mkdirSync(dir, { recursive: true });

        // Copy starter deck from templates/default/deck.json
        const templatePath = path.resolve(process.cwd(), TEMPLATES_DIR, "default", DECK_FILENAME);
        assert(fs.existsSync(templatePath), "Default template not found");
        const template = JSON.parse(fs.readFileSync(templatePath, "utf-8"));

        // Override title if provided
        if (body.title) {
          template.meta = template.meta ?? {};
          template.meta.title = body.title;
        }

        saveDeck(deckPath(name), template);
        jsonResponse(res, 200, { ok: true, name });
      });

      server.middlewares.use("/api/delete-project", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const body = JSON.parse(await readBody(req));
        const name: string = body.name;
        assert(typeof name === "string" && isValidProjectName(name), `Invalid project name: ${name}`);
        const dir = projectDir(name);
        assert(fs.existsSync(dir), `Project "${name}" not found`);

        fs.rmSync(dir, { recursive: true, force: true });
        jsonResponse(res, 200, { ok: true });
      });

      // -- Editor endpoints --

      server.middlewares.use("/api/load-deck", (req, res) => {
        const project = getProjectParam(req);
        const filePath = deckPath(project);
        if (!fs.existsSync(filePath)) {
          jsonResponse(res, 404, { error: "deck.json not found" });
          return;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(content);
      });

      server.middlewares.use("/api/save-deck", async (req, res) => {
        if (req.method !== "POST") {
          jsonResponse(res, 405, { error: "Method not allowed" });
          return;
        }
        const project = getProjectParam(req);
        const body = await readBody(req);
        JSON.parse(body); // crash on invalid JSON (fail-fast)
        const dp = deckPath(project);
        const dir = path.dirname(dp);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dp, body, "utf-8");
        jsonResponse(res, 200, { ok: true });
      });

      // -- AI tool: read-deck --

      server.middlewares.use("/api/ai/read-deck", (req, res) => {
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        jsonResponse(res, 200, deck);
      });

      // -- AI tool: list tools --

      server.middlewares.use("/api/ai/tools", (_req, res) => {
        jsonResponse(res, 200, AI_TOOLS_MANIFEST);
      });

      // -- AI tool: create-deck --

      server.middlewares.use("/api/ai/create-deck", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const body = await readBody(req);
        const deck = JSON.parse(body);
        const valid = validate(deck);
        if (!valid) {
          jsonResponse(res, 400, { error: "Schema validation failed", details: validate.errors });
          return;
        }
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, slides: deck.slides.length });
      });

      // -- AI tool: add-slide --

      server.middlewares.use("/api/ai/add-slide", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slide, afterSlideId } = JSON.parse(await readBody(req));
        assert(slide && typeof slide === "object" && slide.id, "Missing slide object with id");
        assert(Array.isArray(slide.elements), "slide.elements must be an array");

        if (afterSlideId) {
          const idx = deck.slides.findIndex((s: any) => s.id === afterSlideId);
          assert(idx !== -1, `Slide ${afterSlideId} not found`);
          deck.slides.splice(idx + 1, 0, slide);
        } else {
          deck.slides.push(slide);
        }
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, slideId: slide.id, totalSlides: deck.slides.length });
      });

      // -- AI tool: update-slide --

      server.middlewares.use("/api/ai/update-slide", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, patch } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(patch && typeof patch === "object", "Missing patch object");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        Object.assign(slide, patch, { id: slideId }); // preserve id
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, slideId });
      });

      // -- AI tool: delete-slide --

      server.middlewares.use("/api/ai/delete-slide", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        const idx = deck.slides.findIndex((s: any) => s.id === slideId);
        assert(idx !== -1, `Slide ${slideId} not found`);
        deck.slides.splice(idx, 1);
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, remaining: deck.slides.length });
      });

      // -- AI tool: add-element --

      server.middlewares.use("/api/ai/add-element", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, element } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(element && typeof element === "object" && element.id, "Missing element object with id");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        slide.elements.push(element);
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, slideId, elementId: element.id, totalElements: slide.elements.length });
      });

      // -- AI tool: update-element --

      server.middlewares.use("/api/ai/update-element", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, elementId, patch } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(typeof elementId === "string", "Missing elementId");
        assert(patch && typeof patch === "object", "Missing patch object");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        const element = slide.elements.find((e: any) => e.id === elementId);
        assert(element, `Element ${elementId} not found in slide ${slideId}`);
        Object.assign(element, patch, { id: elementId }); // preserve id
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, slideId, elementId });
      });

      // -- AI tool: delete-element --

      server.middlewares.use("/api/ai/delete-element", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const project = getProjectParam(req);
        const deck = loadDeck(deckPath(project));
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, elementId } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(typeof elementId === "string", "Missing elementId");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        const idx = slide.elements.findIndex((e: any) => e.id === elementId);
        assert(idx !== -1, `Element ${elementId} not found in slide ${slideId}`);
        slide.elements.splice(idx, 1);
        saveDeck(deckPath(project), deck);
        notifyDeckChanged(project);
        jsonResponse(res, 200, { ok: true, slideId, remaining: slide.elements.length });
      });
    },
  };
}

// -- Helpers --

function loadDeck(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveDeck(filePath: string, deck: any) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(deck, null, 2), "utf-8");
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Migrate legacy layouts into the multi-project structure.
 *
 * Phase 1: root-level deck.json/assets/ → projects/deck.json + projects/assets/
 *          (handled by previous migration, may already be done)
 *
 * Phase 2: flat projects/deck.json → projects/default/deck.json
 *          Also rewrites /assets/foo → /assets/default/foo in element src fields.
 */
function migrateToProjectDir() {
  const root = projectsRoot();
  const cwd = process.cwd();

  // Phase 1: root-level legacy files → projects/
  const legacyDeck = path.resolve(cwd, DECK_FILENAME);
  const legacyAssets = path.resolve(cwd, "assets");

  if (fs.existsSync(legacyDeck) || fs.existsSync(legacyAssets)) {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    if (fs.existsSync(legacyDeck)) {
      // Move to projects/default/ directly (skip the intermediate flat layout)
      const dest = path.resolve(root, "default", DECK_FILENAME);
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(legacyDeck, dest);
      console.log(`[deckode] Migrated ${DECK_FILENAME} → ${PROJECT_DIR}/default/${DECK_FILENAME}`);
    }
    if (fs.existsSync(legacyAssets) && fs.statSync(legacyAssets).isDirectory()) {
      const dest = path.resolve(root, "default", "assets");
      fs.cpSync(legacyAssets, dest, { recursive: true });
      fs.rmSync(legacyAssets, { recursive: true, force: true });
      console.log(`[deckode] Migrated assets/ → ${PROJECT_DIR}/default/assets/`);
    }
    // Rewrite asset URLs in the migrated deck
    rewriteAssetUrls(path.resolve(root, "default", DECK_FILENAME), "default");
    return; // Phase 1 done, skip phase 2
  }

  // Phase 2: flat projects/deck.json → projects/default/deck.json
  const flatDeck = path.resolve(root, DECK_FILENAME);
  const flatAssets = path.resolve(root, "assets");

  if (fs.existsSync(flatDeck)) {
    const defaultDir = path.resolve(root, "default");
    if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });

    const dest = path.resolve(defaultDir, DECK_FILENAME);
    fs.renameSync(flatDeck, dest);
    console.log(`[deckode] Migrated ${PROJECT_DIR}/${DECK_FILENAME} → ${PROJECT_DIR}/default/${DECK_FILENAME}`);

    if (fs.existsSync(flatAssets) && fs.statSync(flatAssets).isDirectory()) {
      const assetsDest = path.resolve(defaultDir, "assets");
      fs.cpSync(flatAssets, assetsDest, { recursive: true });
      fs.rmSync(flatAssets, { recursive: true, force: true });
      console.log(`[deckode] Migrated ${PROJECT_DIR}/assets/ → ${PROJECT_DIR}/default/assets/`);
    }

    // Rewrite asset URLs: /assets/foo → /assets/default/foo
    rewriteAssetUrls(dest, "default");
  }
}

/** Rewrite /assets/filename → /assets/{project}/filename in element src fields */
function rewriteAssetUrls(deckFilePath: string, project: string) {
  if (!fs.existsSync(deckFilePath)) return;
  const raw = fs.readFileSync(deckFilePath, "utf-8");
  // Replace /assets/ refs that don't already have a project prefix
  // Match /assets/ followed by a filename (not a valid project name + /)
  const rewritten = raw.replace(
    /("src"\s*:\s*"\/assets\/)([^"]+)"/g,
    (match, prefix, rest) => {
      // If the path already starts with a project-like segment followed by /,
      // and that segment is the current project, skip it
      if (rest.startsWith(`${project}/`)) return match;
      return `${prefix}${project}/${rest}"`;
    },
  );
  if (rewritten !== raw) {
    fs.writeFileSync(deckFilePath, rewritten, "utf-8");
    console.log(`[deckode] Rewrote asset URLs in ${deckFilePath}`);
  }
}

// -- AI Tools Manifest --

const AI_TOOLS_MANIFEST = {
  name: "deckode",
  description: "AI tools for creating and modifying Deckode slide decks. All endpoints require ?project=name parameter.",
  guide: "/docs/ai-slide-guide.md",
  schema: "/src/schema/deck.schema.json",
  tools: [
    {
      name: "create-deck",
      method: "POST",
      endpoint: "/api/ai/create-deck?project={name}",
      description: "Create a new deck. Body: full deck.json object. Validates against schema.",
      body: "Deck (full deck.json)",
    },
    {
      name: "add-slide",
      method: "POST",
      endpoint: "/api/ai/add-slide?project={name}",
      description: "Add a slide to the deck.",
      body: '{ "slide": Slide, "afterSlideId"?: string }',
    },
    {
      name: "update-slide",
      method: "POST",
      endpoint: "/api/ai/update-slide?project={name}",
      description: "Update a slide by ID (partial patch).",
      body: '{ "slideId": string, "patch": Partial<Slide> }',
    },
    {
      name: "delete-slide",
      method: "POST",
      endpoint: "/api/ai/delete-slide?project={name}",
      description: "Delete a slide by ID.",
      body: '{ "slideId": string }',
    },
    {
      name: "add-element",
      method: "POST",
      endpoint: "/api/ai/add-element?project={name}",
      description: "Add an element to a slide.",
      body: '{ "slideId": string, "element": Element }',
    },
    {
      name: "update-element",
      method: "POST",
      endpoint: "/api/ai/update-element?project={name}",
      description: "Update an element within a slide (partial patch).",
      body: '{ "slideId": string, "elementId": string, "patch": Partial<Element> }',
    },
    {
      name: "delete-element",
      method: "POST",
      endpoint: "/api/ai/delete-element?project={name}",
      description: "Delete an element from a slide.",
      body: '{ "slideId": string, "elementId": string }',
    },
    {
      name: "read-deck",
      method: "GET",
      endpoint: "/api/ai/read-deck?project={name}",
      description: "Read the current deck state. Returns the full deck.json object.",
      body: null,
    },
  ],
};
