import { useRef, useState, useEffect, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { SelectionOverlay } from "./SelectionOverlay";

export function EditorCanvas() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectElement = useDeckStore((s) => s.selectElement);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 40;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scaleX = availW / CANVAS_WIDTH;
    const scaleY = availH / CANVAS_HEIGHT;
    setScale(Math.min(scaleX, scaleY, 1.5));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  if (!deck) return null;

  const slide = deck.slides[currentSlideIndex];
  assert(slide !== undefined, `Slide index ${currentSlideIndex} out of bounds`);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectElement(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-zinc-900 overflow-hidden"
      onClick={handleCanvasClick}
    >
      <div className="relative">
        <SlideRenderer slide={slide} scale={scale} />
        <SelectionOverlay slide={slide} scale={scale} />
      </div>
    </div>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[EditorCanvas] ${message}`);
}
