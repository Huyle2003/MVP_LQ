import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HeroListScreen from '../features/catalogue/HeroListScreen';
import HeroDetailScreen from '../features/catalogue/HeroDetailScreen';
import SkinDetailScreen from '../features/catalogue/SkinDetailScreen';

export type HeroesStackParamList = {
  HeroList: undefined;
  HeroDetail: { heroId: string; heroName: string };
  SkinDetail: { skinId: string; skinName: string };
};

const Stack = createNativeStackNavigator<HeroesStackParamList>();

export default function HeroesStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HeroList" component={HeroListScreen} options={{ title: 'Tướng' }} />
      <Stack.Screen
        name="HeroDetail"
        component={HeroDetailScreen}
        options={({ route }) => ({ title: route.params.heroName })}
      />
      <Stack.Screen
        name="SkinDetail"
        component={SkinDetailScreen}
        options={({ route }) => ({ title: route.params.skinName })}
      />
    </Stack.Navigator>
  );
}
