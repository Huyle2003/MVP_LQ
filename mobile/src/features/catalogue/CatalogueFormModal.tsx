import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Status } from '../../db/types';
import { absoluteUri, ImagePrefix, importImage } from '../../storage/fileStorage';

export interface CatalogueFormValues {
  name: string;
  code: string;
  status: Status;
  sort_order: string;
  default_quantity: string;
  image_path: string | null;
}

export interface CatalogueFormItem {
  name: string;
  code: string;
  status: Status;
  sort_order?: number;
  default_quantity?: number;
  image_path?: string;
}

interface Props {
  visible: boolean;
  title: string;
  hasImage: boolean;
  hasSortOrder: boolean;
  hasDefaultQuantity: boolean;
  imagePrefix?: ImagePrefix;
  initial?: CatalogueFormItem | null;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    code?: string;
    status: Status;
    sort_order?: number;
    default_quantity?: number;
    image_path?: string;
  }) => Promise<void>;
}

const EMPTY: CatalogueFormValues = {
  name: '',
  code: '',
  status: 'ACTIVE',
  sort_order: '0',
  default_quantity: '0',
  image_path: null,
};

export default function CatalogueFormModal({
  visible,
  title,
  hasImage,
  hasSortOrder,
  hasDefaultQuantity,
  imagePrefix,
  initial,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<CatalogueFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setValues({
        name: initial.name,
        code: initial.code,
        status: initial.status,
        sort_order: String(initial.sort_order ?? 0),
        default_quantity: String(initial.default_quantity ?? 0),
        image_path: initial.image_path ?? null,
      });
    } else {
      setValues(EMPTY);
    }
  }, [visible, initial]);

  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh để chọn ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const relPath = await importImage(result.assets[0].uri, imagePrefix ?? 'other-images');
    setValues((v) => ({ ...v, image_path: relPath }));
  }

  async function handleSubmit() {
    if (!values.name.trim()) {
      Alert.alert('Thiếu tên', 'Vui lòng nhập tên.');
      return;
    }
    if (hasImage && !values.image_path) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chọn ảnh.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        code: values.code.trim() || undefined,
        status: values.status,
        sort_order: hasSortOrder ? Math.max(0, Number(values.sort_order) || 0) : undefined,
        default_quantity: hasDefaultQuantity ? Math.max(0, Number(values.default_quantity) || 0) : undefined,
        image_path: values.image_path ?? undefined,
      });
      onClose();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof Error ? err.message : 'Không thể lưu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {hasImage && (
              <Pressable style={styles.imagePicker} onPress={handlePickImage}>
                {values.image_path ? (
                  <Image source={{ uri: absoluteUri(values.image_path) }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imagePickerText}>Chọn ảnh</Text>
                )}
              </Pressable>
            )}

            <Text style={styles.label}>Tên</Text>
            <TextInput
              style={styles.input}
              value={values.name}
              onChangeText={(t) => setValues((v) => ({ ...v, name: t }))}
              placeholder="Nhập tên"
            />

            <Text style={styles.label}>Mã (để trống để tự sinh)</Text>
            <TextInput
              style={styles.input}
              value={values.code}
              onChangeText={(t) => setValues((v) => ({ ...v, code: t }))}
              placeholder="tu-dong-sinh"
              autoCapitalize="none"
            />

            {hasSortOrder && (
              <>
                <Text style={styles.label}>Thứ tự</Text>
                <TextInput
                  style={styles.input}
                  value={values.sort_order}
                  onChangeText={(t) => setValues((v) => ({ ...v, sort_order: t }))}
                  keyboardType="number-pad"
                />
              </>
            )}

            {hasDefaultQuantity && (
              <>
                <Text style={styles.label}>Số lượng mặc định</Text>
                <TextInput
                  style={styles.input}
                  value={values.default_quantity}
                  onChangeText={(t) => setValues((v) => ({ ...v, default_quantity: t }))}
                  keyboardType="number-pad"
                />
              </>
            )}

            <View style={styles.statusRow}>
              <Text style={styles.label}>Đang hoạt động</Text>
              <Switch
                value={values.status === 'ACTIVE'}
                onValueChange={(on) => setValues((v) => ({ ...v, status: on ? 'ACTIVE' : 'INACTIVE' }))}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onClose} disabled={saving}>
              <Text style={styles.buttonSecondaryText}>Huỷ</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={handleSubmit} disabled={saving}>
              <Text style={styles.buttonPrimaryText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  imagePicker: {
    height: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePickerText: { color: '#64748b', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#2563eb' },
  buttonPrimaryText: { color: '#fff', fontWeight: '700' },
  buttonSecondary: { backgroundColor: '#f1f5f9' },
  buttonSecondaryText: { color: '#334155', fontWeight: '700' },
});
