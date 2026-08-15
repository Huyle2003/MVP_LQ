import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HeroesStackNavigator from './HeroesStack';
import CropScreen from '../features/crop/CropScreen';
import ComposeStackNavigator from './ComposeStack';
import OtherImagesScreen from '../features/catalogue/OtherImagesScreen';
import CountedImagesScreen from '../features/catalogue/CountedImagesScreen';

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Heroes" component={HeroesStackNavigator} options={{ title: 'Tướng & Skin' }} />
      <Tab.Screen
        name="Crop"
        component={CropScreen}
        options={{ title: 'Cắt ảnh', headerShown: true }}
      />
      <Tab.Screen name="Compose" component={ComposeStackNavigator} options={{ title: 'Ghép ảnh' }} />
      <Tab.Screen
        name="OtherImages"
        component={OtherImagesScreen}
        options={{ title: 'Ảnh khác', headerShown: true }}
      />
      <Tab.Screen
        name="CountedImages"
        component={CountedImagesScreen}
        options={{ title: 'Ảnh SL', headerShown: true }}
      />
    </Tab.Navigator>
  );
}
