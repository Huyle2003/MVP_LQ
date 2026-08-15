import { countedImageRepo } from '../../db/db';
import { CountedImage } from '../../db/types';
import CatalogueScreen from './CatalogueScreen';

export default function CountedImagesScreen() {
  return (
    <CatalogueScreen<CountedImage>
      title="ảnh số lượng"
      emptyText="Chưa có ảnh số lượng nào."
      hasImage
      hasSortOrder
      hasDefaultQuantity
      imagePrefix="counted-images"
      repo={countedImageRepo}
      renderSubtitle={(item) => `${item.code} · SL mặc định: ${item.default_quantity}`}
    />
  );
}
