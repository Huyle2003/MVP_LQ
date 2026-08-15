import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ComposeSelectScreen from '../features/compose/ComposeSelectScreen';
import ComposeEditorScreen from '../features/compose/ComposeEditorScreen';
import { SelectedSkinItem, WinRateItem } from '../features/compose/types';

export type ComposeStackParamList = {
  ComposeSelect: undefined;
  ComposeEditor: {
    backgroundPath: string;
    items: SelectedSkinItem[];
    winRateItems: WinRateItem[];
  };
};

const Stack = createNativeStackNavigator<ComposeStackParamList>();

export default function ComposeStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ComposeSelect" component={ComposeSelectScreen} options={{ title: 'Ghép skin' }} />
      <Stack.Screen name="ComposeEditor" component={ComposeEditorScreen} options={{ title: 'Chỉnh sửa layout' }} />
    </Stack.Navigator>
  );
}
