import { useRef, useState, useEffect, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { ImageElement, VideoElement } from "@/types/deck";
import { SelectionOverlay } from "./SelectionOverlay";
import { uploadAsset } from "@/utils/api";

export function EditorCanvas() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectElement = useDeckStore((s) => s.selectElement);
  const addElement = useDeckStore((s) => s.addElement);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return;

    const url = await uploadAsset(file);

    const wrapper = canvasWrapperRef.current;
    assert(wrapper !== null, "canvasWrapperRef not attached");
    const rect = wrapper.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / scale;
    const rawY = (e.clientY - rect.top) / scale;

    const elW = isImage ? 300 : 560;
    const elH = isImage ? 200 : 315;
    const x = Math.max(0, Math.min(rawX - elW / 2, CANVAS_WIDTH - elW));
    const y = Math.max(0, Math.min(rawY - elH / 2, CANVAS_HEIGHT - elH));

    const id = crypto.randomUUID();

    if (isImage) {
      const element: ImageElement = {
        id,
        type: "image",
        src: url,
        position: { x, y },
        size: { w: elW, h: elH },
      };
      addElement(slide.id, element);
    } else {
      const element: VideoElement = {
        id,
        type: "video",
        src: url,
        controls: true,
        position: { x, y },
        size: { w: elW, h: elH },
      };
      addElement(slide.id, element);
    }
    selectElement(id);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-zinc-900 overflow-hidden"
      onClick={handleCanvasClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={canvasWrapperRef} className="relative">
        <SlideRenderer slide={slide} scale={scale} />
        <SelectionOverlay slide={slide} scale={scale} />
      </div>
    </div>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[EditorCanvas] ${message}`);
}
