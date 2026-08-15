import { otherImageRepo } from '../../db/db';
import { OtherImage } from '../../db/types';
import CatalogueScreen from './CatalogueScreen';

export default function OtherImagesScreen() {
  return (
    <CatalogueScreen<OtherImage>
      title="ảnh khác"
      emptyText="Chưa có ảnh nào trong danh mục này."
      hasImage
      hasSortOrder
      imagePrefix="other-images"
      repo={otherImageRepo}
    />
  );
}
