import { Skia, SkImage } from '@shopify/react-native-skia';

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Manual grid config — same fields/defaults as CropConfigPanel's manual mode
 * in the web app (frontend/src/components/skin-crop/CropConfigPanel.jsx). */
export interface ManualCropConfig {
  start_x: number;
  start_y: number;
  card_width: number;
  card_height: number;
  gap_x: number;
  row_count: number;
  count_per_row: number;
}

export const DEFAULT_MANUAL_CROP: ManualCropConfig = {
  start_x: 480,
  start_y: 175,
  card_width: 230,
  card_height: 415,
  gap_x: 12,
  row_count: 1,
  count_per_row: 5,
};

/**
 * Port of backend/app/services/skin_crop_service.py's manual_crop_image loop
 * — including its reuse of gap_x for the vertical row gap too, kept for
 * parity even though it reads a little oddly.
 */
export function computeManualGridBoxes(
  config: ManualCropConfig,
  imageWidth: number,
  imageHeight: number
): CropBox[] {
  const boxes: CropBox[] = [];
  for (let row = 0; row < config.row_count; row++) {
    for (let col = 0; col < config.count_per_row; col++) {
      const left = config.start_x + col * (config.card_width + config.gap_x);
      const top = config.start_y + row * (config.card_height + config.gap_x);
      const right = left + config.card_width;
      const bottom = top + config.card_height;
      if (right > imageWidth || bottom > imageHeight) continue;
      boxes.push({ x: left, y: top, width: config.card_width, height: config.card_height });
    }
  }
  return boxes;
}

export async function loadSkImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Không thể đọc ảnh');
  return image;
}

/** Crop one box out of a loaded SkImage and encode the result as PNG bytes. */
export function cropToPngBytes(image: SkImage, box: CropBox): Uint8Array {
  const surface = Skia.Surface.Make(box.width, box.height);
  if (!surface) throw new Error('Không thể tạo canvas để cắt ảnh');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  const src = Skia.XYWHRect(box.x, box.y, box.width, box.height);
  const dest = Skia.XYWHRect(0, 0, box.width, box.height);
  canvas.drawImageRect(image, src, dest, paint);
  return surface.makeImageSnapshot().encodeToBytes();
}
