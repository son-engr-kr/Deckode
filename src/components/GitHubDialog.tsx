import { useState, useMemo } from "react";
import { parseGitHubUrl, buildDeckodeUrls } from "@/utils/github";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GitHubDialog({ open, onClose }: Props) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<"editor" | "present" | null>(null);

  const parsed = useMemo(() => parseGitHubUrl(input), [input]);

  const urls = useMemo(() => {
    if (!parsed) return null;
    return buildDeckodeUrls(
      window.location.origin,
      window.location.pathname,
      parsed,
    );
  }, [parsed]);

  if (!open) return null;

  const handleClose = () => {
    setInput("");
    setCopied(null);
    onClose();
  };

  const handleOpen = () => {
    if (!urls) return;
    window.location.href = urls.editor;
  };

  const handleCopy = async (type: "editor" | "present") => {
    if (!urls) return;
    const url = type === "editor" ? urls.editor : urls.present;
    await navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasInput = input.trim().length > 0;
  const isInvalid = hasInput && !parsed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-100 mb-1">Open from GitHub</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Paste a GitHub folder URL or use the short format.
        </p>

        {/* Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="https://github.com/owner/repo/tree/main/slides"
            value={input}
            onChange={(e) => { setInput(e.target.value); setCopied(null); }}
            autoFocus
            className={`w-full bg-zinc-800 border rounded px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors ${
              isInvalid
                ? "border-red-600 focus:border-red-500"
                : "border-zinc-700 focus:border-zinc-500"
            }`}
          />
          {isInvalid && (
            <p className="mt-1.5 text-xs text-red-400">
              Could not parse. Use a GitHub folder URL or <code className="text-red-300">owner/repo/path@branch</code> format.
            </p>
          )}
        </div>

        {/* Live preview */}
        {parsed && urls && (
          <div className="mb-4 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 space-y-2">
            <div className="flex gap-4 text-xs">
              <span className="text-zinc-500">Owner</span>
              <span className="text-zinc-200">{parsed.owner}</span>
              <span className="text-zinc-500">Repo</span>
              <span className="text-zinc-200">{parsed.repo}</span>
              {parsed.path && (
                <>
                  <span className="text-zinc-500">Path</span>
                  <span className="text-zinc-200">{parsed.path}</span>
                </>
              )}
              <span className="text-zinc-500">Branch</span>
              <span className="text-zinc-200">{parsed.branch}</span>
            </div>
            <div className="text-xs text-zinc-400 break-all font-mono">
              {urls.editor}
            </div>
          </div>
        )}

        {/* Help text */}
        <details className="mb-5 text-xs text-zinc-500 group">
          <summary className="cursor-pointer hover:text-zinc-300 transition-colors select-none">
            How to get the GitHub folder URL
          </summary>
          <div className="mt-2 pl-3 border-l border-zinc-700 space-y-2 text-zinc-400">
            <p>Navigate to the folder containing <code className="text-zinc-300">deck.json</code> on GitHub, then copy the URL from the address bar.</p>
            <img
              src={`${import.meta.env.BASE_URL}github-folder-guide.png`}
              alt="GitHub folder view showing deck.json — copy this page's URL"
              className="rounded border border-zinc-700 w-full"
            />
            <p>The URL should look like: <code className="text-zinc-300">https://github.com/owner/repo/tree/main/path</code></p>
          </div>
        </details>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleCopy("present")}
            disabled={!parsed}
            className="px-4 py-2 rounded bg-zinc-700 border border-zinc-600 text-sm text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {copied === "present" ? "Copied!" : "Copy Present Link"}
          </button>
          <button
            onClick={() => handleCopy("editor")}
            disabled={!parsed}
            className="px-4 py-2 rounded bg-zinc-700 border border-zinc-600 text-sm text-zinc-200 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {copied === "editor" ? "Copied!" : "Copy Editor Link"}
          </button>
          <button
            onClick={handleOpen}
            disabled={!parsed}
            className="px-5 py-2 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
