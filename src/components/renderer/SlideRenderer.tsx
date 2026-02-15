import type { Slide } from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { ElementRenderer } from "./ElementRenderer";

interface Props {
  slide: Slide;
  scale: number;
}

export function SlideRenderer({ slide, scale }: Props) {
  const bg = slide.background;

  return (
    <div
      style={{
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: bg?.color ?? "#0f172a",
          backgroundImage: bg?.image ? `url(${bg.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {slide.elements.map((element) => (
          <ElementRenderer key={element.id} element={element} />
        ))}
      </div>
    </div>
  );
}
