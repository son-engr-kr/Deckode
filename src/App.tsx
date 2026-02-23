import { useEffect, useState, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { setStoreAdapter } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { PresenterView } from "@/components/presenter/PresenterView";
import { ProjectSelector } from "@/components/ProjectSelector";
import { AdapterProvider } from "@/contexts/AdapterContext";
import { ViteApiAdapter } from "@/adapters/viteApi";
import { loadDeckFromDisk } from "@/utils/api";
import type { FileSystemAdapter } from "@/adapters/types";

const IS_DEV = import.meta.env.DEV;

export function App() {
  const currentProject = useDeckStore((s) => s.currentProject);
  const [adapter, setAdapter] = useState<FileSystemAdapter | null>(null);
  const [externalChange, setExternalChange] = useState(false);

  // In dev mode, auto-open project from URL query param
  useEffect(() => {
    if (!IS_DEV) return;
    const params = new URLSearchParams(window.location.search);
    const project = params.get("project");
    if (project) {
      const viteAdapter = new ViteApiAdapter(project);
      setAdapter(viteAdapter);
      setStoreAdapter(viteAdapter);
      loadDeckFromDisk(project).then((deck) => {
        if (deck) useDeckStore.getState().openProject(project, deck);
      });
    }
  }, []);

  // Capture URL mode once on mount — the URL sync effect below may strip
  // query params before the next render, so we must read this eagerly.
  const [isAudiencePopup] = useState(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    return mode === "audience" || mode === "presenter";
  });

  // Sync URL when project changes (dev mode only)
  useEffect(() => {
    if (!IS_DEV) return;
    if (currentProject) {
      const params = new URLSearchParams(window.location.search);
      params.set("project", currentProject);
      history.replaceState(null, "", `?${params.toString()}`);
    } else {
      history.replaceState(null, "", window.location.pathname);
    }
  }, [currentProject]);

  // HMR: reload deck when deck.json changes on disk (dev mode only)
  useEffect(() => {
    if (!IS_DEV || !import.meta.hot) return;
    const handler = (data: { project: string }) => {
      const state = useDeckStore.getState();
      if (data.project !== state.currentProject || !adapter) return;

      if (!state.isDirty) {
        // Clean → auto-reload
        adapter.loadDeck().then((deck) => {
          useDeckStore.getState().loadDeck(deck);
        });
      } else {
        // Dirty → show conflict bar
        setExternalChange(true);
      }
    };
    import.meta.hot.on("deckode:deck-changed", handler);
    return () => {
      import.meta.hot!.off("deckode:deck-changed", handler);
    };
  }, [adapter]);

  const handleReloadExternal = useCallback(() => {
    if (!adapter) return;
    adapter.loadDeck().then((deck) => {
      useDeckStore.getState().loadDeck(deck);
      setExternalChange(false);
    });
  }, [adapter]);

  const handleKeepMine = useCallback(() => {
    setExternalChange(false);
  }, []);

  const handleAdapterReady = useCallback((newAdapter: FileSystemAdapter) => {
    setAdapter(newAdapter);
    setStoreAdapter(newAdapter);
  }, []);

  // Clear adapter when project is closed (prod mode)
  useEffect(() => {
    if (!currentProject && !IS_DEV) {
      setAdapter(null);
      setStoreAdapter(null);
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <ProjectSelector
        isDevMode={IS_DEV}
        onAdapterReady={handleAdapterReady}
      />
    );
  }

  assert(adapter !== null, "Adapter must be set when a project is open");

  return (
    <AdapterProvider adapter={adapter}>
      {externalChange && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium shadow-lg">
          <span>deck.json was modified externally</span>
          <button
            onClick={handleReloadExternal}
            className="px-2 py-0.5 rounded bg-white text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
          >
            Reload
          </button>
          <button
            onClick={handleKeepMine}
            className="px-2 py-0.5 rounded bg-amber-700 text-amber-100 hover:bg-amber-800 transition-colors"
          >
            Keep mine
          </button>
        </div>
      )}
      {isAudiencePopup ? <PresenterView /> : <EditorLayout />}
    </AdapterProvider>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[App] ${message}`);
}
