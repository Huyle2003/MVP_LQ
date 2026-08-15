import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { heroRepo, heroSkinRepo } from '../../db/db';
import { Hero, Status } from '../../db/types';
import { absoluteUri } from '../../storage/fileStorage';

interface Props {
  visible: boolean;
  /** Relative path (already saved under crop-sources/) of the tile to attach. */
  imagePath: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CreateSkinFromCropModal({ visible, imagePath, onClose, onSaved }: Props) {
  const [heroKeyword, setHeroKeyword] = useState('');
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('ACTIVE');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setHeroKeyword('');
    setSelectedHero(null);
    setName('');
    setCode('');
    setStatus('ACTIVE');
    setSortOrder('0');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(async () => {
      const rows = await heroRepo.list({ keyword: heroKeyword || undefined, status: 'ACTIVE' });
      setHeroes(rows);
    }, 250);
    return () => clearTimeout(t);
  }, [visible, heroKeyword]);

  async function handleSubmit() {
    if (!imagePath) return;
    if (!selectedHero) {
      Alert.alert('Thiếu tướng', 'Vui lòng chọn tướng cho skin này.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Thiếu tên', 'Vui lòng nhập tên skin.');
      return;
    }
    setSaving(true);
    try {
      await heroSkinRepo.create(selectedHero.id, {
        name: name.trim(),
        code: code.trim() || undefined,
        image_path: imagePath,
        status,
        sort_order: Math.max(0, Number(sortOrder) || 0),
      });
      onSaved();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu skin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Thêm skin vào tướng</Text>

          {imagePath && <Image source={{ uri: absoluteUri(imagePath) }} style={styles.preview} />}

          <Text style={styles.label}>Tướng</Text>
          {selectedHero ? (
            <View style={styles.selectedHero}>
              <Text style={styles.selectedHeroText}>{selectedHero.name}</Text>
              <Pressable onPress={() => setSelectedHero(null)}>
                <Text style={styles.changeHero}>Đổi</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Tìm tướng..."
                value={heroKeyword}
                onChangeText={setHeroKeyword}
              />
              <FlatList
                style={styles.heroList}
                data={heroes}
                keyExtractor={(h) => h.id}
                renderItem={({ item }) => (
                  <Pressable style={styles.heroRow} onPress={() => setSelectedHero(item)}>
                    <Text>{item.name}</Text>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>Không tìm thấy tướng</Text>}
              />
            </>
          )}

          <Text style={styles.label}>Tên skin</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nhập tên skin" />

          <Text style={styles.label}>Mã skin (để trống để tự sinh)</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} autoCapitalize="none" />

          <Text style={styles.label}>Thứ tự</Text>
          <TextInput style={styles.input} value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" />

          <View style={styles.statusRow}>
            <Text style={styles.label}>Đang hoạt động</Text>
            <Switch value={status === 'ACTIVE'} onValueChange={(on) => setStatus(on ? 'ACTIVE' : 'INACTIVE')} />
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onClose} disabled={saving}>
              <Text style={styles.buttonSecondaryText}>Huỷ</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.buttonPrimaryText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  preview: { width: 100, height: 100, borderRadius: 8, alignSelf: 'center', marginBottom: 10, backgroundColor: '#e2e8f0' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  heroList: { maxHeight: 140, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginTop: 4 },
  heroRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  emptyText: { padding: 12, color: '#94a3b8', fontSize: 13 },
  selectedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedHeroText: { fontWeight: '600', color: '#1d4ed8' },
  changeHero: { color: '#2563eb', fontWeight: '600', fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#2563eb' },
  buttonPrimaryText: { color: '#fff', fontWeight: '700' },
  buttonSecondary: { backgroundColor: '#f1f5f9' },
  buttonSecondaryText: { color: '#334155', fontWeight: '700' },
});
