import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { ListFilter, Status } from '../../db/types';
import { ImagePrefix, absoluteUri } from '../../storage/fileStorage';
import CatalogueFormModal, { CatalogueFormItem } from './CatalogueFormModal';

export interface CatalogueRepo<T extends CatalogueFormItem & { id: string }> {
  list: (filter?: ListFilter) => Promise<T[]>;
  create: (input: {
    name: string;
    code?: string;
    status?: Status;
    sort_order?: number;
    default_quantity?: number;
    image_path?: string;
  }) => Promise<string>;
  update: (
    id: string,
    patch: {
      name?: string;
      code?: string;
      status?: Status;
      sort_order?: number;
      default_quantity?: number;
      image_path?: string;
    }
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

interface Props<T extends CatalogueFormItem & { id: string }> {
  title: string;
  emptyText: string;
  hasImage: boolean;
  hasSortOrder: boolean;
  hasDefaultQuantity?: boolean;
  imagePrefix?: ImagePrefix;
  repo: CatalogueRepo<T>;
  /** When provided, tapping a row navigates instead of opening the edit form. */
  onPressItem?: (item: T) => void;
  renderSubtitle?: (item: T) => string;
  /** Bumped by the parent to force a reload (e.g. after returning from a detail screen). */
  reloadKey?: number;
}

export default function CatalogueScreen<T extends CatalogueFormItem & { id: string }>({
  title,
  emptyText,
  hasImage,
  hasSortOrder,
  hasDefaultQuantity = false,
  imagePrefix,
  repo,
  onPressItem,
  renderSubtitle,
  reloadKey,
}: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await repo.list({ keyword: keyword || undefined, status: statusFilter });
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, [repo, keyword, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, reloadKey]);

  // Re-fetch every time this screen gains focus (e.g. navigating back from a
  // detail screen after adding/editing something there) so lists never show
  // stale data without the user having to manually pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openCreate() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setModalVisible(true);
  }

  function handleDelete(item: T) {
    Alert.alert('Xoá', `Xoá "${item.name}"? Các mục liên quan bên trong cũng sẽ bị xoá.`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await repo.remove(item.id);
          load();
        },
      },
    ]);
  }

  async function handleSubmit(values: Parameters<CatalogueRepo<T>['create']>[0]) {
    if (editing) {
      await repo.update(editing.id, values);
    } else {
      await repo.create(values);
    }
    load();
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm..."
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
        <View style={styles.statusChips}>
          {(['ACTIVE', 'INACTIVE'] as Status[]).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter((cur) => (cur === s ? undefined : s))}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s === 'ACTIVE' ? 'Hoạt động' : 'Ngừng'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            android_ripple={{ color: '#e2e8f0' }}
            onPress={() => (onPressItem ? onPressItem(item) : openEdit(item))}
          >
            {hasImage && item.image_path && (
              <Image source={{ uri: absoluteUri(item.image_path) }} style={styles.thumb} />
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {renderSubtitle ? renderSubtitle(item) : item.code}
                {item.status === 'INACTIVE' ? ' · Ngừng hoạt động' : ''}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable style={styles.rowActionBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil-outline" size={16} color="#2563eb" />
              </Pressable>
              <Pressable style={styles.rowActionBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        android_ripple={{ color: '#1d4ed8' }}
        onPress={openCreate}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.fabText}>Thêm</Text>
      </Pressable>

      <CatalogueFormModal
        visible={modalVisible}
        title={editing ? `Sửa ${title}` : `Thêm ${title}`}
        hasImage={hasImage}
        hasSortOrder={hasSortOrder}
        hasDefaultQuantity={hasDefaultQuantity}
        imagePrefix={imagePrefix}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  filterBar: { padding: 12, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14 },
  statusChips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#dbeafe' },
  chipText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  chipTextActive: { color: '#1d4ed8' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowPressed: { backgroundColor: '#f8fafc' },
  thumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e2e8f0' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  rowMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6 },
  rowActionBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabPressed: { backgroundColor: '#1d4ed8' },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
