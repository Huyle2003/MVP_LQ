import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';

import { skinButtonRepo, skinKillNotificationRepo } from '../../db/db';
import { SkinButton, SkinKillNotification } from '../../db/types';
import { HeroesStackParamList } from '../../navigation/HeroesStack';
import CatalogueScreen, { CatalogueRepo } from './CatalogueScreen';

type Rt = RouteProp<HeroesStackParamList, 'SkinDetail'>;
type Tab = 'buttons' | 'kill_notifications';

export default function SkinDetailScreen() {
  const { params } = useRoute<Rt>();
  const skinId = params.skinId;
  const [tab, setTab] = useState<Tab>('buttons');

  const buttonRepo = useMemo<CatalogueRepo<SkinButton>>(
    () => ({
      list: (filter) => skinButtonRepo.list(skinId, filter) as Promise<SkinButton[]>,
      create: (input) => skinButtonRepo.create(skinId, { ...input, image_path: input.image_path! }),
      update: (id, patch) => skinButtonRepo.update(id, patch),
      remove: (id) => skinButtonRepo.remove(id),
    }),
    [skinId]
  );

  const notificationRepo = useMemo<CatalogueRepo<SkinKillNotification>>(
    () => ({
      list: (filter) => skinKillNotificationRepo.list(skinId, filter) as Promise<SkinKillNotification[]>,
      create: (input) => skinKillNotificationRepo.create(skinId, { ...input, image_path: input.image_path! }),
      update: (id, patch) => skinKillNotificationRepo.update(id, patch),
      remove: (id) => skinKillNotificationRepo.remove(id),
    }),
    [skinId]
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'buttons' && styles.tabActive]} onPress={() => setTab('buttons')}>
          <Text style={[styles.tabText, tab === 'buttons' && styles.tabTextActive]}>Nút bấm</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'kill_notifications' && styles.tabActive]}
          onPress={() => setTab('kill_notifications')}
        >
          <Text style={[styles.tabText, tab === 'kill_notifications' && styles.tabTextActive]}>Thông báo hạ</Text>
        </Pressable>
      </View>

      {tab === 'buttons' ? (
        <CatalogueScreen<SkinButton>
          title="nút bấm"
          emptyText="Skin này chưa có nút bấm nào."
          hasImage
          hasSortOrder
          imagePrefix="buttons"
          repo={buttonRepo}
        />
      ) : (
        <CatalogueScreen<SkinKillNotification>
          title="thông báo hạ"
          emptyText="Skin này chưa có thông báo hạ nào."
          hasImage
          hasSortOrder
          imagePrefix="kill-notifications"
          repo={notificationRepo}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1d4ed8' },
});
