import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";

interface Props {
  onDone: () => void;
}

export function PrintExport({ onDone }: Props) {
  const deck = useDeckStore((s) => s.deck);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    // Delay to let all slides render before triggering print
    const timer = setTimeout(() => window.print(), 400);

    const handleAfterPrint = () => onDone();
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [onDone]);

  if (!deck) return null;

  // Portal renders directly into document.body so @media print can
  // hide #root while keeping the print container visible.
  return createPortal(
    <div className="print-export-container">
      {deck.slides.map((slide) => (
        <div key={slide.id} className="print-export-page">
          <SlideRenderer slide={slide} scale={1} theme={deck.theme} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
