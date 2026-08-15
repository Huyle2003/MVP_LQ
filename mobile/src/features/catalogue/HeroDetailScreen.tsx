import { useMemo } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { heroSkinRepo } from '../../db/db';
import { HeroSkin } from '../../db/types';
import { HeroesStackParamList } from '../../navigation/HeroesStack';
import CatalogueScreen, { CatalogueRepo } from './CatalogueScreen';

type Nav = NativeStackNavigationProp<HeroesStackParamList, 'HeroDetail'>;
type Rt = RouteProp<HeroesStackParamList, 'HeroDetail'>;

export default function HeroDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const heroId = params.heroId;

  const repo = useMemo<CatalogueRepo<HeroSkin>>(
    () => ({
      list: (filter) => heroSkinRepo.list(heroId, filter),
      create: (input) =>
        heroSkinRepo.create(heroId, {
          name: input.name,
          code: input.code,
          image_path: input.image_path!,
          status: input.status,
          sort_order: input.sort_order,
        }),
      update: (id, patch) => heroSkinRepo.update(id, patch),
      remove: (id) => heroSkinRepo.remove(id),
    }),
    [heroId]
  );

  return (
    <CatalogueScreen<HeroSkin>
      title="skin"
      emptyText="Tướng này chưa có skin nào. Cắt ảnh từ tab Cắt ảnh hoặc thêm trực tiếp tại đây."
      hasImage
      hasSortOrder
      imagePrefix="skins"
      repo={repo}
      onPressItem={(skin) => navigation.navigate('SkinDetail', { skinId: skin.id, skinName: skin.name })}
    />
  );
}
