import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useDeckStore } from "@/stores/deckStore";
import type { Deck } from "@/types/deck";

export function CodePanel() {
  const deck = useDeckStore((s) => s.deck);
  const replaceDeck = useDeckStore((s) => s.replaceDeck);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const suppressChange = useRef(false);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!value || suppressChange.current) return;
      const parsed = JSON.parse(value) as Deck;
      suppressChange.current = true;
      replaceDeck(parsed);
      suppressChange.current = false;
    },
    [replaceDeck],
  );

  if (!deck) return null;

  // Sync store → editor only when editor is not focused (user not typing)
  const json = JSON.stringify(deck, null, 2);
  if (editorRef.current) {
    const editor = editorRef.current;
    const model = editor.getModel();
    if (model && !editor.hasTextFocus()) {
      const currentValue = model.getValue();
      if (currentValue !== json) {
        suppressChange.current = true;
        model.setValue(json);
        suppressChange.current = false;
      }
    }
  }

  return (
    <div className="h-full">
      <Editor
        height="100%"
        language="json"
        theme="vs-dark"
        defaultValue={json}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
