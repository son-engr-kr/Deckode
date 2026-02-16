import { useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { ProjectSelector } from "@/components/ProjectSelector";
import { loadDeckFromDisk } from "@/utils/api";

export function App() {
  const currentProject = useDeckStore((s) => s.currentProject);

  // Auto-open project from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const project = params.get("project");
    if (project) {
      loadDeckFromDisk(project).then((deck) => {
        if (deck) {
          useDeckStore.getState().openProject(project, deck);
        }
      });
    }
  }, []);

  // Sync URL when project changes
  useEffect(() => {
    if (currentProject) {
      history.replaceState(null, "", `?project=${encodeURIComponent(currentProject)}`);
    } else {
      history.replaceState(null, "", window.location.pathname);
    }
  }, [currentProject]);

  // Reload deck when AI modifies it via API (project-aware)
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = (data: { project: string }) => {
      const state = useDeckStore.getState();
      if (data.project !== state.currentProject) return;
      loadDeckFromDisk(data.project).then((deck) => {
        if (deck) useDeckStore.getState().replaceDeck(deck);
      });
    };
    import.meta.hot.on("deckode:deck-changed", handler);
    return () => {
      import.meta.hot!.off("deckode:deck-changed", handler);
    };
  }, []);

  if (!currentProject) {
    return <ProjectSelector />;
  }

  return <EditorLayout />;
}
