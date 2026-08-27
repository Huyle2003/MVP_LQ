import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { absoluteUri, deleteImage, importImage, saveBytes } from '../../storage/fileStorage';
import {
  computeManualGridBoxes,
  cropToPngBytes,
  DEFAULT_MANUAL_CROP,
  loadSkImage,
  ManualCropConfig,
} from './cropEngine';
import CreateSkinFromCropModal from './CreateSkinFromCropModal';

interface CroppedTile {
  id: string;
  path: string;
}

const FIELDS: { key: keyof ManualCropConfig; label: string }[] = [
  { key: 'start_x', label: 'X bắt đầu' },
  { key: 'start_y', label: 'Y bắt đầu' },
  { key: 'card_width', label: 'Rộng' },
  { key: 'card_height', label: 'Cao' },
  { key: 'gap_x', label: 'Khoảng cách' },
  { key: 'row_count', label: 'Số hàng' },
  { key: 'count_per_row', label: 'Số cột' },
];

export default function CropScreen() {
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [config, setConfig] = useState<ManualCropConfig>({ ...DEFAULT_MANUAL_CROP });
  const [cropping, setCropping] = useState(false);
  const [tiles, setTiles] = useState<CroppedTile[]>([]);
  const [selectedTile, setSelectedTile] = useState<CroppedTile | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [message, setMessage] = useState('');

  const boxes = useMemo(
    () => (nat.w > 0 && nat.h > 0 ? computeManualGridBoxes(config, nat.w, nat.h) : []),
    [config, nat]
  );

  function handleResetPage() {
    setSourceUri(null);
    setNat({ w: 0, h: 0 });
    setContainerWidth(0);
    setConfig({ ...DEFAULT_MANUAL_CROP });
    setTiles([]);
    setSelectedTile(null);
    setMessage('');
  }

  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setSourceUri(asset.uri);
    setTiles([]);
    setSelectedTile(null);
    setMessage('');
    setNat({ w: 0, h: 0 });
    // Always measure via Image.getSize — the same native decoder the
    // <Image> preview below uses to render — rather than trusting
    // asset.width/height from the picker, which can disagree with the
    // rendered size (e.g. EXIF-rotated photos) and throw the grid overlay
    // off from the actual card positions.
    Image.getSize(
      asset.uri,
      (w, h) => setNat({ w, h }),
      () => {
        if (asset.width && asset.height) setNat({ w: asset.width, h: asset.height });
      }
    );
  }

  async function handleAddExistingCrop() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const added: CroppedTile[] = [];
    for (const asset of result.assets) {
      const path = await importImage(asset.uri, 'crop-sources');
      added.push({ id: `${Date.now()}-${added.length}-${Math.random()}`, path });
    }
    setTiles((prev) => [...prev, ...added]);
    setMessage(`Đã thêm ${added.length} ảnh có sẵn`);
  }

  function updateField(key: keyof ManualCropConfig, text: string) {
    const value = Math.max(0, Number(text.replace(/[^0-9]/g, '')) || 0);
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function onContainerLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  async function handleCrop() {
    if (!sourceUri) return;
    if (boxes.length === 0) {
      Alert.alert('Không có ô nào', 'Cấu hình lưới không khớp với kích thước ảnh, vui lòng chỉnh lại.');
      return;
    }
    setCropping(true);
    setMessage('Đang cắt ảnh...');
    try {
      const image = await loadSkImage(sourceUri);
      const newTiles: CroppedTile[] = [];
      for (let i = 0; i < boxes.length; i++) {
        const bytes = cropToPngBytes(image, boxes[i]);
        const path = saveBytes(bytes, 'crop-sources', 'png');
        newTiles.push({ id: `${Date.now()}-${i}`, path });
      }
      setTiles((prev) => [...prev, ...newTiles]);
      setMessage(`Cắt thành công ${newTiles.length} ảnh skin`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi khi cắt ảnh');
    } finally {
      setCropping(false);
    }
  }

  function handleDeleteTile(tile: CroppedTile) {
    deleteImage(tile.path);
    setTiles((prev) => prev.filter((t) => t.id !== tile.id));
    if (selectedTile?.id === tile.id) setSelectedTile(null);
  }

  const scale = containerWidth > 0 && nat.w > 0 ? containerWidth / nat.w : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.pickButton} onPress={handlePickImage}>
          <Text style={styles.pickButtonText}>{sourceUri ? 'Chọn ảnh khác' : 'Chọn ảnh nguồn'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleAddExistingCrop}>
          <Text style={styles.secondaryButtonText}>+ Thêm ảnh đã cắt sẵn (nếu cắt tự động bị lỗi)</Text>
        </Pressable>

        {(sourceUri || tiles.length > 0) && (
          <Pressable style={styles.resetButton} onPress={handleResetPage}>
            <Text style={styles.resetButtonText}>Làm mới trang</Text>
          </Pressable>
        )}

        {sourceUri && (
          <View style={styles.previewWrap} onLayout={onContainerLayout}>
            {containerWidth > 0 && nat.w > 0 && (
              <View style={{ width: containerWidth, height: containerWidth * (nat.h / nat.w) }}>
                <Image source={{ uri: sourceUri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
                {boxes.map((box, i) => (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[
                      styles.gridBox,
                      {
                        left: box.x * scale,
                        top: box.y * scale,
                        width: box.width * scale,
                        height: box.height * scale,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {sourceUri && (
          <View style={styles.configGrid}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.configField}>
                <Text style={styles.configLabel}>{f.label}</Text>
                <TextInput
                  style={styles.configInput}
                  keyboardType="number-pad"
                  value={String(config[f.key])}
                  onChangeText={(t) => updateField(f.key, t)}
                />
              </View>
            ))}
          </View>
        )}

        {sourceUri && (
          <Pressable style={styles.cropButton} onPress={handleCrop} disabled={cropping}>
            {cropping ? <ActivityIndicator color="#fff" /> : <Text style={styles.cropButtonText}>Cắt ảnh ({boxes.length} ô)</Text>}
          </Pressable>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {tiles.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ảnh đã cắt ({tiles.length})</Text>
            <FlatList
              data={tiles}
              numColumns={3}
              keyExtractor={(t) => t.id}
              scrollEnabled={false}
              columnWrapperStyle={styles.tileRow}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.tile, selectedTile?.id === item.id && styles.tileSelected]}
                  onPress={() => setSelectedTile(item)}
                  onLongPress={() => handleDeleteTile(item)}
                >
                  <Image source={{ uri: absoluteUri(item.path) }} style={styles.tileImage} />
                </Pressable>
              )}
            />
            <Text style={styles.hint}>Giữ để xoá một ảnh.</Text>
          </>
        )}
      </ScrollView>

      {selectedTile && (
        <Pressable style={styles.assignBar} onPress={() => setAssignModalVisible(true)}>
          <Text style={styles.assignBarText}>Thêm skin vào tướng</Text>
        </Pressable>
      )}

      <CreateSkinFromCropModal
        visible={assignModalVisible}
        imagePath={selectedTile?.path ?? null}
        onClose={() => setAssignModalVisible(false)}
        onSaved={() => {
          setAssignModalVisible(false);
          setMessage('Đã thêm skin thành công');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  pickButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  pickButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  resetButton: { backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
  resetButtonText: { color: '#b91c1c', fontWeight: '600', fontSize: 12 },
  previewWrap: { marginTop: 12, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' },
  gridBox: { position: 'absolute', borderWidth: 2, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
  configGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  configField: { width: '30%' },
  configLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  configInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13 },
  cropButton: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  cropButtonText: { color: '#fff', fontWeight: '700' },
  message: { marginTop: 10, color: '#334155', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8, color: '#0f172a' },
  tileRow: { gap: 8, marginBottom: 8 },
  tile: { flex: 1, aspectRatio: 0.75, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: '#e2e8f0' },
  tileSelected: { borderColor: '#2563eb' },
  tileImage: { width: '100%', height: '100%' },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  assignBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  assignBarText: { color: '#fff', fontWeight: '700' },
});
