import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { heroRepo } from '../../db/db';
import { HeroesStackParamList } from '../../navigation/HeroesStack';
import CatalogueScreen from './CatalogueScreen';

type Nav = NativeStackNavigationProp<HeroesStackParamList, 'HeroList'>;

export default function HeroListScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <CatalogueScreen
      title="tướng"
      emptyText="Chưa có tướng nào. Nhấn Thêm để tạo."
      hasImage={false}
      hasSortOrder={false}
      repo={heroRepo}
      onPressItem={(hero) => navigation.navigate('HeroDetail', { heroId: hero.id, heroName: hero.name })}
    />
  );
}
