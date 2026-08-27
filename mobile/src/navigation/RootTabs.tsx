import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HeroesStackNavigator from './HeroesStack';
import CropScreen from '../features/crop/CropScreen';
import ComposeStackNavigator from './ComposeStack';
import OtherImagesScreen from '../features/catalogue/OtherImagesScreen';
import CountedImagesScreen from '../features/catalogue/CountedImagesScreen';

const Tab = createBottomTabNavigator();

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outlineName: IoniconName, filledName: IoniconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filledName : outlineName} size={size} color={color} />
  );
}

export default function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Heroes"
        component={HeroesStackNavigator}
        options={{ title: 'Tướng & Skin', tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tab.Screen
        name="Crop"
        component={CropScreen}
        options={{ title: 'Cắt ảnh', headerShown: true, tabBarIcon: tabIcon('cut-outline', 'cut') }}
      />
      <Tab.Screen
        name="Compose"
        component={ComposeStackNavigator}
        options={{ title: 'Ghép ảnh', tabBarIcon: tabIcon('layers-outline', 'layers') }}
      />
      <Tab.Screen
        name="OtherImages"
        component={OtherImagesScreen}
        options={{ title: 'Ảnh khác', headerShown: true, tabBarIcon: tabIcon('image-outline', 'image') }}
      />
      <Tab.Screen
        name="CountedImages"
        component={CountedImagesScreen}
        options={{ title: 'Ảnh SL', headerShown: true, tabBarIcon: tabIcon('calculator-outline', 'calculator') }}
      />
    </Tab.Navigator>
  );
}
