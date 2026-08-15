import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { heroRepo, heroSkinRepo, skinButtonRepo, skinKillNotificationRepo } from '../../db/db';
import { Hero, HeroSkin } from '../../db/types';
import { absoluteUri, importImage } from '../../storage/fileStorage';
import { ComposeStackParamList } from '../../navigation/ComposeStack';
import { SelectedSkinItem, WinRateItem } from './types';

type Nav = NativeStackNavigationProp<ComposeStackParamList, 'ComposeSelect'>;

export default function ComposeSelectScreen() {
  const navigation = useNavigation<Nav>();

  const [bgPath, setBgPath] = useState<string | null>(null);
  const [heroKeyword, setHeroKeyword] = useState('');
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [skins, setSkins] = useState<HeroSkin[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedSkinItem[]>([]);
  const [winRateItems, setWinRateItems] = useState<WinRateItem[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      setHeroes(await heroRepo.list({ keyword: heroKeyword || undefined, status: 'ACTIVE' }));
    }, 250);
    return () => clearTimeout(t);
  }, [heroKeyword]);

  async function handleSelectHero(hero: Hero) {
    setSelectedHero(hero);
    setSkins(await heroSkinRepo.list(hero.id, { status: 'ACTIVE' }));
  }

  async function handlePickBackground() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const relPath = await importImage(result.assets[0].uri, 'backgrounds');
    setBgPath(relPath);
  }

  async function handleAddSkin(skin: HeroSkin) {
    if (selectedItems.some((s) => s.skinId === skin.id)) return;
    const [buttons, kills] = await Promise.all([
      skinButtonRepo.list(skin.id, { status: 'ACTIVE' }),
      skinKillNotificationRepo.list(skin.id, { status: 'ACTIVE' }),
    ]);
    setSelectedItems((prev) => [
      ...prev,
      {
        skinId: skin.id,
        heroName: selectedHero?.name ?? '',
        skinName: skin.name,
        imagePath: skin.image_path,
        availableButtons: buttons.map((b) => ({ id: b.id, name: b.name, image_path: b.image_path })),
        availableKillNotifications: kills.map((k) => ({ id: k.id, name: k.name, image_path: k.image_path })),
        useButton: false,
        selectedButtonId: buttons[0]?.id ?? null,
        useKillNotification: false,
        selectedKillNotificationId: kills[0]?.id ?? null,
      },
    ]);
  }

  function updateItem(skinId: string, patch: Partial<SelectedSkinItem>) {
    setSelectedItems((prev) => prev.map((it) => (it.skinId === skinId ? { ...it, ...patch } : it)));
  }

  function removeItem(skinId: string) {
    setSelectedItems((prev) => prev.filter((it) => it.skinId !== skinId));
  }

  async function handlePickWinRate() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true });
    if (result.canceled || !result.assets?.length) return;
    const added: WinRateItem[] = [];
    for (const asset of result.assets) {
      const relPath = await importImage(asset.uri, 'win-rate');
      added.push({ id: `${Date.now()}-${added.length}`, imagePath: relPath, fileName: asset.fileName ?? 'win-rate.png' });
    }
    setWinRateItems((prev) => [...prev, ...added]);
  }

  function removeWinRate(id: string) {
    setWinRateItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleCreateLayout() {
    if (!bgPath) {
      setMessage('Chọn ảnh nền trước');
      return;
    }
    if (selectedItems.length === 0 && winRateItems.length === 0) {
      setMessage('Chọn ít nhất một skin hoặc ảnh tỷ lệ thắng');
      return;
    }
    navigation.navigate('ComposeEditor', { backgroundPath: bgPath, items: selectedItems, winRateItems });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>1. Ảnh nền</Text>
      <Pressable style={styles.pickButton} onPress={handlePickBackground}>
        <Text style={styles.pickButtonText}>{bgPath ? 'Chọn ảnh nền khác' : 'Chọn ảnh nền'}</Text>
      </Pressable>
      {bgPath && <Image source={{ uri: absoluteUri(bgPath) }} style={styles.bgPreview} />}

      <Text style={styles.sectionTitle}>2. Chọn skin từ danh mục</Text>
      <TextInput style={styles.input} placeholder="Tìm tướng..." value={heroKeyword} onChangeText={setHeroKeyword} />
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        style={styles.heroChips}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.heroChip, selectedHero?.id === item.id && styles.heroChipActive]}
            onPress={() => handleSelectHero(item)}
          >
            <Text style={[styles.heroChipText, selectedHero?.id === item.id && styles.heroChipTextActive]}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
      {selectedHero && (
        <FlatList
          data={skins}
          keyExtractor={(s) => s.id}
          numColumns={3}
          columnWrapperStyle={styles.skinRow}
          renderItem={({ item }) => {
            const added = selectedItems.some((s) => s.skinId === item.id);
            return (
              <Pressable style={[styles.skinCard, added && styles.skinCardAdded]} onPress={() => handleAddSkin(item)}>
                <Image source={{ uri: absoluteUri(item.image_path) }} style={styles.skinCardImage} />
                <Text style={styles.skinCardName} numberOfLines={1}>{item.name}</Text>
                {added && <Text style={styles.skinCardAddedText}>Đã chọn</Text>}
              </Pressable>
            );
          }}
        />
      )}

      <Text style={styles.sectionTitle}>3. Skin đã chọn ({selectedItems.length})</Text>
      {selectedItems.map((item) => (
        <View key={item.skinId} style={styles.selectedRow}>
          <Image source={{ uri: absoluteUri(item.imagePath) }} style={styles.selectedImage} />
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{item.heroName} - {item.skinName}</Text>
            {item.availableButtons.length > 0 && (
              <View style={styles.checkRow}>
                <Switch value={item.useButton} onValueChange={(v) => updateItem(item.skinId, { useButton: v })} />
                <Text style={styles.checkLabel}>Ghép nút bấm</Text>
              </View>
            )}
            {item.availableKillNotifications.length > 0 && (
              <View style={styles.checkRow}>
                <Switch
                  value={item.useKillNotification}
                  onValueChange={(v) => updateItem(item.skinId, { useKillNotification: v })}
                />
                <Text style={styles.checkLabel}>Ghép thông báo hạ</Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => removeItem(item.skinId)}>
            <Text style={styles.removeText}>Xoá</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Ảnh tỷ lệ thắng (không bắt buộc)</Text>
      <Pressable style={styles.pickButton} onPress={handlePickWinRate}>
        <Text style={styles.pickButtonText}>Thêm ảnh tỷ lệ thắng</Text>
      </Pressable>
      {winRateItems.map((item) => (
        <View key={item.id} style={styles.selectedRow}>
          <Image source={{ uri: absoluteUri(item.imagePath) }} style={styles.selectedImage} />
          <Text style={styles.selectedInfo}>{item.fileName}</Text>
          <Pressable onPress={() => removeWinRate(item.id)}>
            <Text style={styles.removeText}>Xoá</Text>
          </Pressable>
        </View>
      ))}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={handleCreateLayout}>
        <Text style={styles.primaryButtonText}>Tạo layout chỉnh sửa</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8, color: '#0f172a' },
  pickButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  pickButtonText: { color: '#fff', fontWeight: '700' },
  bgPreview: { width: '100%', height: 160, borderRadius: 8, marginTop: 10, resizeMode: 'cover' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  heroChips: { marginTop: 10 },
  heroChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f1f5f9', marginRight: 8 },
  heroChipActive: { backgroundColor: '#dbeafe' },
  heroChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  heroChipTextActive: { color: '#1d4ed8' },
  skinRow: { gap: 8, marginBottom: 8 },
  skinCard: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 6, alignItems: 'center' },
  skinCardAdded: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  skinCardImage: { width: '100%', aspectRatio: 0.75, borderRadius: 6, backgroundColor: '#e2e8f0' },
  skinCardName: { fontSize: 11, marginTop: 4, color: '#0f172a' },
  skinCardAddedText: { fontSize: 10, color: '#2563eb', fontWeight: '700' },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  selectedImage: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e2e8f0' },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  checkLabel: { fontSize: 12, color: '#334155' },
  removeText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  message: { marginTop: 12, color: '#dc2626', fontSize: 13 },
  primaryButton: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
