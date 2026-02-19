import type { Deck } from "@/types/deck";
import type { FileSystemAdapter, ProjectInfo } from "./types";

export class FsAccessAdapter implements FileSystemAdapter {
  readonly mode = "fs-access" as const;
  private dirHandle: FileSystemDirectoryHandle;
  private blobUrlCache = new Map<string, string>();
  readonly projectName: string;

  constructor(dirHandle: FileSystemDirectoryHandle) {
    this.dirHandle = dirHandle;
    this.projectName = dirHandle.name;
  }

  static async openDirectory(): Promise<FsAccessAdapter> {
    // showDirectoryPicker is part of the File System Access API (Chrome/Edge)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const showDirectoryPicker = (window as any).showDirectoryPicker as (
      options?: { mode?: "read" | "readwrite" },
    ) => Promise<FileSystemDirectoryHandle>;
    const dirHandle = await showDirectoryPicker({ mode: "readwrite" });
    return new FsAccessAdapter(dirHandle);
  }

  async loadDeck(): Promise<Deck> {
    const fileHandle = await this.dirHandle.getFileHandle("deck.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as Deck;
  }

  async saveDeck(deck: Deck): Promise<void> {
    const fileHandle = await this.dirHandle.getFileHandle("deck.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(deck, null, 2));
    await writable.close();
  }

  async listProjects(): Promise<ProjectInfo[]> {
    // Single project = the opened directory
    const deck = await this.loadDeck();
    return [{ name: this.projectName, title: deck.meta.title }];
  }

  async createProject(_name: string, _title?: string): Promise<void> {
    throw new Error("Creating projects is not supported in File System Access mode. Open a different folder instead.");
  }

  async deleteProject(_name: string): Promise<void> {
    throw new Error("Deleting projects is not supported in File System Access mode.");
  }

  async uploadAsset(file: File): Promise<string> {
    const assetsDir = await this.dirHandle.getDirectoryHandle("assets", { create: true });

    // Deduplicate filename
    let name = file.name;
    let counter = 1;
    while (true) {
      try {
        await assetsDir.getFileHandle(name);
        // File exists, generate a new name
        const dot = file.name.lastIndexOf(".");
        const base = dot === -1 ? file.name : file.name.slice(0, dot);
        const ext = dot === -1 ? "" : file.name.slice(dot);
        name = `${base}-${counter}${ext}`;
        counter++;
      } catch {
        // File doesn't exist, use this name
        break;
      }
    }

    const fileHandle = await assetsDir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    const storedPath = `/assets/${this.projectName}/${name}`;
    // Pre-cache the blob URL
    const blob = new Blob([file], { type: file.type });
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrlCache.set(storedPath, blobUrl);

    return storedPath;
  }

  async resolveAssetUrl(path: string): Promise<string> {
    const cached = this.blobUrlCache.get(path);
    if (cached) return cached;

    // Path format: /assets/{project}/{filename}
    // We need to read from the assets/ subdirectory in our handle
    const parts = path.replace(/^\//, "").split("/");
    // Expected: ["assets", projectName, ...rest]
    assert(parts.length >= 3, `Invalid asset path: ${path}`);

    let currentHandle: FileSystemDirectoryHandle = this.dirHandle;
    // Navigate to the "assets" subdirectory (skip the project name in the path)
    const assetsDir = await currentHandle.getDirectoryHandle("assets");
    const filename = parts.slice(2).join("/");

    const fileHandle = await assetsDir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    this.blobUrlCache.set(path, blobUrl);
    return blobUrl;
  }

  async renderTikz(
    _elementId: string,
    _content: string,
    _preamble?: string,
  ): Promise<{ ok: true; svgUrl: string } | { ok: false; error: string }> {
    return {
      ok: false,
      error: "TikZ rendering requires the dev server (npm run dev). It is not available in static/offline mode.",
    };
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[FsAccessAdapter] ${message}`);
}
