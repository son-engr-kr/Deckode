import { useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { loadDeckFromDisk } from "@/utils/api";
import sampleDeck from "../templates/default/deck.json";
import type { Deck } from "@/types/deck";

export function App() {
  useEffect(() => {
    loadDeckFromDisk().then((deck) => {
      useDeckStore.getState().loadDeck(deck ?? (sampleDeck as Deck));
    });
  }, []);

  return <EditorLayout />;
}
