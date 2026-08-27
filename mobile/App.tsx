import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import RootTabs from './src/navigation/RootTabs';
import { seedCatalogIfNeeded, SeedFailure, SeedProgress } from './src/db/seedCatalog';
import { isUnlocked } from './src/features/auth/unlockGate';
import UnlockScreen from './src/features/auth/UnlockScreen';

export default function App() {
  const [unlocked, setUnlocked] = useState(() => isUnlocked());

  if (!unlocked) {
    return <UnlockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return <MainApp />;
}

function MainApp() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [failures, setFailures] = useState<SeedFailure[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    seedCatalogIfNeeded((p) => setProgress(p))
      .then((f) => setFailures(f))
      .catch((err) => setFatalError(err instanceof Error ? err.message : String(err)))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang chuẩn bị dữ liệu offline...</Text>
        {progress && (
          <Text style={styles.loadingProgress}>
            {progress.stage} — {progress.done}/{progress.total}
          </Text>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootTabs />
        </NavigationContainer>
        <StatusBar style="auto" />
        {fatalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Không nạp được dữ liệu mẫu: {fatalError}</Text>
          </View>
        )}
        {!fatalError && failures.length > 0 && (
          <Pressable style={styles.warnBanner} onPress={() => setDetailsVisible(true)}>
            <Text style={styles.warnText}>
              {failures.length} mục dữ liệu mẫu không nạp được — chạm để xem chi tiết
            </Text>
          </Pressable>
        )}

        <Modal visible={detailsVisible} animationType="slide" onRequestClose={() => setDetailsVisible(false)}>
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Chi tiết lỗi ({failures.length})</Text>
            <FlatList
              data={failures}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <View style={styles.failureRow}>
                  <Text style={styles.failureKey}>[{item.stage}] {item.key}</Text>
                  <Text style={styles.failureError}>{item.error}</Text>
                </View>
              )}
            />
            <Pressable style={styles.closeBtn} onPress={() => setDetailsVisible(false)}>
              <Text style={styles.closeBtnText}>Đóng</Text>
            </Pressable>
          </View>
        </Modal>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 12 },
  loadingText: { fontSize: 14, color: '#334155', fontWeight: '600' },
  loadingProgress: { fontSize: 12, color: '#94a3b8' },
  errorBanner: { position: 'absolute', left: 12, right: 12, top: 44, backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, elevation: 4 },
  errorText: { color: '#991b1b', fontSize: 12 },
  warnBanner: { position: 'absolute', left: 12, right: 12, top: 44, backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, elevation: 4 },
  warnText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  detailsContainer: { flex: 1, paddingTop: 50, paddingHorizontal: 16, backgroundColor: '#fff' },
  detailsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  failureRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  failureKey: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  failureError: { fontSize: 11, color: '#dc2626', marginTop: 2, fontFamily: 'monospace' },
  closeBtn: { marginVertical: 16, alignItems: 'center', paddingVertical: 12, backgroundColor: '#2563eb', borderRadius: 8 },
  closeBtnText: { color: '#fff', fontWeight: '700' },
});
