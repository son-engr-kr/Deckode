import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";

interface Props {
  onDone: () => void;
}

/**
 * PDF Export using the browser's native print engine.
 * Renders slides in a portal, triggers window.print(), then removes.
 */
export function PrintExport({ onDone }: Props) {
  const deck = useDeckStore((s) => s.deck);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    // Small delay to ensure all slides (TikZ, etc.) have had a moment to render
    const timer = setTimeout(() => {
      window.print();
      onDone();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onDone]);

  if (!deck) return null;

  return createPortal(
    <div className="print-export-container">
      {deck.slides
        .filter((s) => !s.hidden)
        .map((slide) => (
          <div
            key={slide.id}
            className="print-export-page"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          >
            <SlideRenderer slide={slide} scale={1} theme={deck.theme} />
          </div>
        ))}
    </div>,
    document.body,
  );
}
