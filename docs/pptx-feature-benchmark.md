# Export Feature Benchmark

Feature matrix comparing Canvas (ground truth) vs each export format.

| Feature | Canvas | PDF Image | PDF Native | PPTX |
|---|---|---|---|---|
| **Text** | | | | |
| Plain text | Yes | Yes | Yes | Yes |
| Bold | Yes | Yes | Yes | Yes |
| Italic | Yes | Yes | Yes | Yes |
| Headings (h1/h2/h3) | Yes | Yes | Yes (fontScale) | Yes (fontScale) |
| Bullet lists | Yes | Yes | Yes | Yes |
| Inline code | Yes | Yes | Yes (Courier) | Yes (Courier New + highlight) |
| CJK text (Korean/Chinese/Japanese) | Yes | Yes | Yes (rasterized) | Yes (plain text) |
| Text alignment (left/center/right) | Yes | Yes | Yes | Yes |
| Vertical alignment | Yes | Yes | Yes | Yes |
| Flexible text sizing | Yes | Yes | Yes (binary search) | No (fixed) |
| **Code** | | | | |
| Syntax highlighting (Shiki) | Yes | Yes | Yes (colored tokens) | Yes (colored TextProps) |
| Background fill | Yes | Yes | Yes (roundedRect) | Yes (fill) |
| Auto-fit font size | Yes | Yes | Yes | No |
| **Shapes** | | | | |
| Rectangle | Yes | Yes | Yes | Yes |
| Ellipse | Yes | Yes | Yes | Yes |
| Line | Yes | Yes | Yes | Yes |
| Arrow | Yes | Yes | Yes | Yes (endArrowType) |
| Border-radius | Yes | Yes | Yes | Yes (rectRadius) |
| Opacity | Yes | Yes | Yes (GState) | Yes (transparency) |
| **Images** | | | | |
| PNG/JPEG | Yes | Yes | Yes | Yes |
| SVG (rasterized) | Yes | Yes | Yes | Yes |
| object-fit (contain/cover/fill) | Yes | Yes | Yes | No (fill only) |
| Opacity | Yes | Yes | Yes | Yes (transparency) |
| **Tables** | | | | |
| Header row (styled) | Yes | Yes | Yes | Yes |
| Data rows | Yes | Yes | Yes | Yes |
| Borders | Yes | Yes | Yes | Yes |
| Striped rows | Yes | Yes | No | No |
| **Math (KaTeX)** | | | | |
| Inline math | Yes | Yes | Yes (rasterized) | Partial (plain text fallback) |
| Block math | Yes | Yes | Yes (rasterized) | Yes (rasterized image) |
| **TikZ Diagrams** | | | | |
| SVG rendering | Yes | Yes | Yes (rasterized) | Yes (rasterized image) |
| **Video** | | | | |
| Playback | Yes | N/A | N/A | N/A |
| Placeholder | N/A | Yes | Yes | Yes |
| **Custom Elements** | | | | |
| Component rendering | Yes | Yes | No (placeholder) | No (placeholder) |
| Placeholder | N/A | N/A | Yes | Yes |
| **Layout** | | | | |
| Rotation | Yes | No | Yes (cm operator) | Yes (rotate prop) |
| Background color | Yes | Yes | Yes | Yes |
| Background image | Yes | Yes | Yes | Yes |
| Speaker notes | N/A | N/A | N/A | Yes |
| Hidden slide exclusion | Yes | Yes | Yes | Yes |
| **Output Quality** | | | | |
| Selectable text | N/A | No | Yes | Yes |
| Vector graphics | Yes | No (rasterized) | Yes | Yes |
| File size | N/A | Large | Small | Medium |

## Missing PPTX Features (Investigation Backlog)

- **Gradients**: PptxGenJS supports linear/radial gradient fills but canvas renderer doesn't use them yet
- **Shadows**: PptxGenJS `shadow` property exists; not implemented in canvas
- **Transitions**: PptxGenJS supports slide transitions; would need mapping from deck.json transition types
- **Master slides**: PptxGenJS supports slide masters; could be used for consistent branding
- **SmartArt**: Not available in PptxGenJS; would require manual layout
- **Flexible text sizing**: PPTX `autoFit` / `shrinkText` could approximate the binary-search sizing
- **Inline math images**: PPTX text runs can't embed images; would need to split into text + image + text
- **Object-fit for images**: Would need manual aspect ratio calculation before calling addImage
