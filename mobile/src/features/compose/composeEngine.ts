import { PaintStyle, Skia, SkCanvas, SkImage } from '@shopify/react-native-skia';

import { absoluteUri } from '../../storage/fileStorage';
import { loadSkImage } from '../crop/cropEngine';

export async function loadSkImageFromPath(relativePath: string): Promise<SkImage> {
  return loadSkImage(absoluteUri(relativePath));
}

// ─── Low-level image ops (port of skin_board_composer.py helpers) ─────────
function resizeExact(image: SkImage, width: number, height: number): SkImage {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const surface = Skia.Surface.Make(w, h);
  if (!surface) throw new Error('Không thể tạo canvas');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, w, h),
    paint
  );
  return surface.makeImageSnapshot();
}

export function resizeByHeight(image: SkImage, targetHeight: number): SkImage {
  const ratio = targetHeight / image.height();
  return resizeExact(image, image.width() * ratio, targetHeight);
}

function getOverlayPosition(
  baseW: number,
  baseH: number,
  ow: number,
  oh: number,
  position: string,
  padding = 8
): [number, number] {
  if (position === 'top_left') return [padding, padding];
  if (position === 'top_right') return [baseW - ow - padding, padding];
  if (position === 'bottom_left') return [padding, baseH - oh - padding];
  if (position === 'center') return [(baseW - ow) / 2, (baseH - oh) / 2];
  if (position.startsWith('center_pct_')) {
    const pct = Math.max(0, Math.min(100, parseInt(position.replace('center_pct_', ''), 10) || 0));
    return [(baseW - ow) / 2, Math.round(((baseH - oh) * pct) / 100)];
  }
  return [baseW - ow - padding, baseH - oh - padding]; // bottom_right default
}

/** Port of apply_overlay() in skin_board_composer.py — pastes a resized overlay onto base. */
export function applyOverlay(base: SkImage, overlay: SkImage, position: string, widthRatio: number, padding = 8): SkImage {
  const targetW = Math.max(1, Math.round(base.width() * widthRatio));
  const targetH = Math.round((overlay.height() * targetW) / overlay.width());
  const resizedOverlay = resizeExact(overlay, targetW, targetH);
  const [x, y] = getOverlayPosition(base.width(), base.height(), targetW, targetH, position, padding);

  const surface = Skia.Surface.Make(base.width(), base.height());
  if (!surface) throw new Error('Không thể tạo canvas');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  canvas.drawImage(base, 0, 0, paint);
  canvas.drawImage(resizedOverlay, x, y, paint);
  return surface.makeImageSnapshot();
}

export function buildHorizontalRow(images: SkImage[], gap: number): SkImage {
  if (images.length === 0) throw new Error('Không có ảnh skin nào để ghép');
  const h = images[0].height();
  let totalW = images.reduce((s, img) => s + img.width(), 0);
  if (gap > 0 && images.length > 1) totalW += gap * (images.length - 1);

  const surface = Skia.Surface.Make(Math.max(1, totalW), h);
  if (!surface) throw new Error('Không thể tạo canvas');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  let cx = 0;
  for (const img of images) {
    canvas.drawImage(img, cx, 0, paint);
    cx += img.width() + gap;
  }
  return surface.makeImageSnapshot();
}

export function addBorder(image: SkImage, borderSize: number, padding: number, color: string): SkImage {
  if (borderSize <= 0 && padding <= 0) return image;
  const cw = image.width() + 2 * (padding + borderSize);
  const ch = image.height() + 2 * (padding + borderSize);
  const surface = Skia.Surface.Make(cw, ch);
  if (!surface) throw new Error('Không thể tạo canvas');
  const canvas = surface.getCanvas();
  const fillPaint = Skia.Paint();
  fillPaint.setColor(Skia.Color(color));
  canvas.drawRect(Skia.XYWHRect(0, 0, cw, ch), fillPaint);
  canvas.drawImage(image, borderSize + padding, borderSize + padding, Skia.Paint());
  return surface.makeImageSnapshot();
}

function paintWithOpacity(opacity: number) {
  const paint = Skia.Paint();
  if (opacity < 1) paint.setAlphaf(Math.max(0, Math.min(1, opacity)));
  return paint;
}

// ─── Quantity text (port of _render_counted_layer's draw.text call) ───────
export interface CountedTextConfig {
  fontSize: number;
  fontColor: string;
  strokeColor: string;
  strokeWidth: number;
  position: 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left' | 'center';
  offsetX: number;
  offsetY: number;
}

function drawQuantityText(canvas: SkCanvas, quantity: number, imgW: number, imgH: number, text: CountedTextConfig) {
  if (quantity <= 0) return;
  const font = Skia.Font(undefined, text.fontSize);
  const str = String(quantity);
  const bounds = font.measureText(str);
  const metrics = font.getMetrics();

  const offsetMap: Record<string, [number, number]> = {
    bottom_right: [imgW + text.offsetX, imgH + text.offsetY],
    bottom_left: [text.offsetX, imgH + text.offsetY],
    top_right: [imgW + text.offsetX, text.offsetY],
    top_left: [text.offsetX, text.offsetY],
    center: [imgW / 2, imgH / 2],
  };
  const alignMap: Record<string, { h: 'l' | 'r' | 'm'; v: 't' | 'b' | 'm' }> = {
    bottom_right: { h: 'r', v: 'b' },
    bottom_left: { h: 'l', v: 'b' },
    top_right: { h: 'r', v: 't' },
    top_left: { h: 'l', v: 't' },
    center: { h: 'm', v: 'm' },
  };
  const [tx, ty] = offsetMap[text.position] ?? offsetMap.bottom_right;
  const align = alignMap[text.position] ?? alignMap.bottom_right;

  let drawX = tx;
  if (align.h === 'r') drawX = tx - bounds.width;
  else if (align.h === 'm') drawX = tx - bounds.width / 2;

  let drawY = ty;
  if (align.v === 't') drawY = ty - metrics.ascent;
  else if (align.v === 'm') drawY = ty - (metrics.ascent + metrics.descent) / 2;

  if (text.strokeWidth > 0) {
    const strokePaint = Skia.Paint();
    strokePaint.setAntiAlias(true);
    strokePaint.setColor(Skia.Color(text.strokeColor));
    strokePaint.setStyle(PaintStyle.Stroke);
    strokePaint.setStrokeWidth(text.strokeWidth * 2);
    canvas.drawText(str, drawX, drawY, strokePaint, font);
  }
  const fillPaint = Skia.Paint();
  fillPaint.setAntiAlias(true);
  fillPaint.setColor(Skia.Color(text.fontColor));
  canvas.drawText(str, drawX, drawY, fillPaint, font);
}

// ─── Layer configs (mirrors ComposeEditorOptions in compose_schema.py) ────
export interface RowConfig {
  x: number;
  y: number;
  height: number;
  gap: number;
  borderSize: number;
  borderPadding: number;
  borderColor: string;
  scale: number;
  align: 'left' | 'center';
  stretchFit: boolean;
  zIndex: number;
}

export interface SkinItemInput {
  image: SkImage;
  useButton: boolean;
  buttonImage?: SkImage;
  buttonPosition: string;
  buttonWidthRatio: number;
  useKillNotification: boolean;
  killNotificationImage?: SkImage;
  killNotificationPosition: string;
  killNotificationWidthRatio: number;
}

export interface ExtraLayerInput {
  image: SkImage;
  x: number;
  y: number;
  width: number;
  height: number; // 0 = auto (keep ratio)
  scale: number;
  borderSize: number;
  borderPadding: number;
  borderColor: string;
  opacity: number;
  zIndex: number;
}

export interface CountedLayerInput {
  image: SkImage;
  x: number;
  y: number;
  width: number;
  quantity: number;
  borderSize: number;
  borderColor: string;
  opacity: number;
  zIndex: number;
  text: CountedTextConfig;
}

export interface ComposeInput {
  background: SkImage;
  skinItems: SkinItemInput[];
  skinRow: RowConfig;
  winRateImages: SkImage[];
  winRateRow: RowConfig | null;
  skinPlacement: 'inside_background' | 'below_background';
  wrPlacement: 'inside_background' | 'below_background';
  merged: boolean;
  sectionGap: number;
  backgroundColor: string;
  extras: ExtraLayerInput[];
  countedLayers: CountedLayerInput[];
}

function composeRowImage(items: SkinItemInput[], row: RowConfig): SkImage {
  const processed = items.map((item) => {
    let img = resizeByHeight(item.image, row.height);
    if (item.useButton && item.buttonImage) {
      img = applyOverlay(img, item.buttonImage, item.buttonPosition, item.buttonWidthRatio);
    }
    if (item.useKillNotification && item.killNotificationImage) {
      img = applyOverlay(img, item.killNotificationImage, item.killNotificationPosition, item.killNotificationWidthRatio);
    }
    return img;
  });
  let rowImg = buildHorizontalRow(processed, row.gap);
  if (row.borderSize > 0) rowImg = addBorder(rowImg, row.borderSize, row.borderPadding, row.borderColor);
  if (row.scale !== 1 && row.scale > 0) {
    rowImg = resizeExact(rowImg, rowImg.width() * row.scale, rowImg.height() * row.scale);
  }
  return rowImg;
}

function renderExtraLayer(extra: ExtraLayerInput): { image: SkImage; x: number; y: number; zIndex: number } {
  let img = extra.image;
  const targetH = extra.height > 0 ? extra.height : Math.round((img.height() * extra.width) / img.width());
  img = resizeExact(img, extra.width, targetH);
  if (extra.scale !== 1 && extra.scale > 0) {
    img = resizeExact(img, img.width() * extra.scale, img.height() * extra.scale);
  }
  if (extra.borderSize > 0) {
    img = addBorder(img, extra.borderSize, extra.borderPadding, extra.borderColor);
  }
  return { image: img, x: extra.x, y: extra.y, zIndex: extra.zIndex };
}

function renderCountedLayer(layer: CountedLayerInput): { image: SkImage; x: number; y: number; zIndex: number } {
  let img = layer.image;
  const targetH = Math.round((img.height() * layer.width) / img.width());
  img = resizeExact(img, layer.width, targetH);
  if (layer.borderSize > 0) img = addBorder(img, layer.borderSize, 4, layer.borderColor);

  const surface = Skia.Surface.Make(img.width(), img.height());
  if (!surface) throw new Error('Không thể tạo canvas');
  const canvas = surface.getCanvas();
  canvas.drawImage(img, 0, 0, paintWithOpacity(layer.opacity));
  drawQuantityText(canvas, layer.quantity, img.width(), img.height(), layer.text);
  return { image: surface.makeImageSnapshot(), x: layer.x, y: layer.y, zIndex: layer.zIndex };
}

/** Faithful port of compose_skin_board_editor_v2() in skin_board_editor_composer.py. */
export function composeFinal(input: ComposeInput): Uint8Array {
  const bg = input.background;

  const rowImg = input.skinItems.length > 0 ? composeRowImage(input.skinItems, input.skinRow) : null;

  let wrImg: SkImage | null = null;
  if (!input.merged && input.winRateImages.length > 0 && input.winRateRow) {
    const wrItems: SkinItemInput[] = input.winRateImages.map((image) => ({
      image,
      useButton: false,
      buttonPosition: 'center_pct_75',
      buttonWidthRatio: 0.35,
      useKillNotification: false,
      killNotificationPosition: 'center_pct_50',
      killNotificationWidthRatio: 1,
    }));
    wrImg = composeRowImage(wrItems, input.winRateRow);
  }

  const stretch = (img: SkImage | null, flag: boolean): SkImage | null => {
    if (!img || !flag) return img;
    return resizeExact(img, bg.width(), (img.height() * bg.width()) / img.width());
  };
  const stretchedRow = stretch(rowImg, input.skinPlacement === 'below_background' && input.skinRow.stretchFit);
  const stretchedWr = stretch(
    wrImg,
    !!input.winRateRow && input.wrPlacement === 'below_background' && input.winRateRow.stretchFit
  );

  const extraLayers = [
    ...input.extras.map(renderExtraLayer),
    ...input.countedLayers.map(renderCountedLayer),
  ];

  type Layer = { z: number; image: SkImage; x: number; y: number };
  let canvasW: number;
  let canvasH: number;
  const layers: Layer[] = [];

  const belowMode = input.skinPlacement === 'below_background' || input.wrPlacement === 'below_background' || input.merged;

  if (belowMode) {
    const rr = stretchedRow ? { w: stretchedRow.width(), h: stretchedRow.height() } : { w: 0, h: 0 };
    const ww = stretchedWr ? { w: stretchedWr.width(), h: stretchedWr.height() } : { w: 0, h: 0 };
    canvasW = Math.max(bg.width(), rr.w, ww.w);
    let totalH = bg.height();
    if (input.skinPlacement === 'below_background' && stretchedRow) totalH += input.sectionGap + rr.h;
    if (!input.merged && input.wrPlacement === 'below_background' && stretchedWr) totalH += input.sectionGap + ww.h;
    if (input.merged && input.skinPlacement === 'below_background' && stretchedRow) {
      totalH = bg.height() + input.sectionGap + rr.h;
    }
    canvasH = totalH;

    layers.push({ z: -1, image: bg, x: 0, y: 0 });
    let curY = bg.height();

    if (stretchedRow) {
      if (input.skinPlacement === 'below_background' || input.merged) {
        const sx = input.skinRow.align === 'center' ? (canvasW - rr.w) / 2 : input.skinRow.x;
        const sy = curY + input.sectionGap;
        curY = sy + rr.h;
        layers.push({ z: input.skinRow.zIndex, image: stretchedRow, x: sx, y: sy });
      } else {
        layers.push({ z: input.skinRow.zIndex, image: stretchedRow, x: input.skinRow.x, y: input.skinRow.y });
      }
    }
    if (stretchedWr && !input.merged && input.winRateRow) {
      if (input.wrPlacement === 'below_background') {
        const wx = input.winRateRow.align === 'center' ? (canvasW - ww.w) / 2 : input.winRateRow.x;
        const wy = curY + input.sectionGap;
        layers.push({ z: input.winRateRow.zIndex, image: stretchedWr, x: wx, y: wy });
      } else {
        layers.push({ z: input.winRateRow.zIndex, image: stretchedWr, x: input.winRateRow.x, y: input.winRateRow.y });
      }
    }
  } else {
    canvasW = bg.width();
    canvasH = bg.height();
    layers.push({ z: -1, image: bg, x: 0, y: 0 });
    if (stretchedRow) layers.push({ z: input.skinRow.zIndex, image: stretchedRow, x: input.skinRow.x, y: input.skinRow.y });
    if (stretchedWr && !input.merged && input.winRateRow) {
      layers.push({ z: input.winRateRow.zIndex, image: stretchedWr, x: input.winRateRow.x, y: input.winRateRow.y });
    }
  }

  for (const extra of extraLayers) {
    layers.push({ z: extra.zIndex, image: extra.image, x: extra.x, y: extra.y });
  }

  layers.sort((a, b) => a.z - b.z);

  const surface = Skia.Surface.Make(Math.max(1, Math.round(canvasW)), Math.max(1, Math.round(canvasH)));
  if (!surface) throw new Error('Không thể tạo canvas để ghép ảnh');
  const canvas = surface.getCanvas();
  const bgFill = Skia.Paint();
  bgFill.setColor(Skia.Color(input.backgroundColor));
  canvas.drawRect(Skia.XYWHRect(0, 0, canvasW, canvasH), bgFill);
  for (const layer of layers) {
    canvas.drawImage(layer.image, layer.x, layer.y, Skia.Paint());
  }

  return surface.makeImageSnapshot().encodeToBytes();
}
