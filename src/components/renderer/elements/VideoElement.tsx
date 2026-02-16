import type { VideoElement as VideoElementType } from "@/types/deck";

interface Props {
  element: VideoElementType;
  thumbnail?: boolean;
}

function parseVideoUrl(src: string): { type: "youtube" | "vimeo" | "native"; embedUrl: string } {
  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = src.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
  );
  if (ytMatch) {
    return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Vimeo: vimeo.com/ID
  const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return { type: "native", embedUrl: src };
}

export function VideoElementRenderer({ element, thumbnail }: Props) {
  const style = element.style ?? {};

  const commonStyle: React.CSSProperties = {
    width: element.size.w,
    height: element.size.h,
    objectFit: (style.objectFit ?? "contain") as React.CSSProperties["objectFit"],
    borderRadius: style.borderRadius ?? 0,
  };

  // Thumbnail mode: static placeholder, no video loading
  if (thumbnail) {
    return (
      <div
        style={{ ...commonStyle, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#18181b" }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </div>
    );
  }

  const { type, embedUrl } = parseVideoUrl(element.src);

  if (type === "youtube" || type === "vimeo") {
    const params = new URLSearchParams();
    if (element.autoplay) params.set("autoplay", "1");
    if (element.loop) params.set("loop", "1");
    if (element.muted) params.set("mute", "1");
    const paramStr = params.toString();
    const url = paramStr ? `${embedUrl}?${paramStr}` : embedUrl;

    return (
      <iframe
        src={url}
        style={{ ...commonStyle, border: "none" }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={embedUrl}
      autoPlay={element.autoplay}
      loop={element.loop}
      muted={element.muted}
      controls={element.controls}
      style={commonStyle}
    />
  );
}
