import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as Crypto from 'expo-crypto';

import { countedImageRepo, otherImageRepo } from '../../db/db';
import { CountedImage, OtherImage } from '../../db/types';
import { absoluteUri, saveBytes, deleteImage } from '../../storage/fileStorage';
import { ComposeStackParamList } from '../../navigation/ComposeStack';
import { composeFinal, loadSkImageFromPath, CountedTextConfig } from './composeEngine';
import DraggableLayer from './DraggableLayer';

type Rt = RouteProp<ComposeStackParamList, 'ComposeEditor'>;
type Placement = 'inside_background' | 'below_background';

interface ExtraLayerState {
  id: string;
  name: string;
  imagePath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  borderSize: number;
  borderPadding: number;
  borderColor: string;
  opacity: number;
  zIndex: number;
}

interface CountedLayerState {
  id: string;
  name: string;
  imagePath: string;
  x: number;
  y: number;
  width: number;
  quantity: number;
  borderSize: number;
  borderColor: string;
  opacity: number;
  zIndex: number;
  text: CountedTextConfig;
}

const DEFAULT_COUNTED_TEXT: CountedTextConfig = {
  fontSize: 32,
  fontColor: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  position: 'bottom_right',
  offsetX: -4,
  offsetY: -4,
};

export default function ComposeEditorScreen() {
  const { params } = useRoute<Rt>();
  const { backgroundPath, items, winRateItems } = params;

  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [containerWidth, setContainerWidth] = useState(0);
  const ds = containerWidth > 0 ? containerWidth / nat.w : 0;

  // Skin row
  const [ex, setEx] = useState(0);
  const [ey, setEy] = useState(0);
  const [sh, setSh] = useState(320);
  const [sg, setSg] = useState(0);
  const [bs, setBs] = useState(5);
  const [bp, setBp] = useState(4);
  const [bc, setBc] = useState('#ffffff');
  const [ss, setSs] = useState(1);

  // Win rate row
  const [wrX, setWrX] = useState(0);
  const [wrY, setWrY] = useState(0);
  const [wrH, setWrH] = useState(200);
  const [wrGap, setWrGap] = useState(0);
  const [wrBs, setWrBs] = useState(5);
  const [wrBp, setWrBp] = useState(4);
  const [wrBc, setWrBc] = useState('#ffffff');
  const [wrSs, setWrSs] = useState(1);

  const [skinPlacement, setSkinPlacement] = useState<Placement>('inside_background');
  const [wrPlacement, setWrPlacement] = useState<Placement>('inside_background');
  const [merged, setMerged] = useState(false);
  const [sectionGap, setSectionGap] = useState(0);

  const [extras, setExtras] = useState<ExtraLayerState[]>([]);
  const [countedLayers, setCountedLayers] = useState<CountedLayerState[]>([]);
  const [active, setActive] = useState<string | null>('skin');

  const [otherImages, setOtherImages] = useState<OtherImage[]>([]);
  const [countedCatalogue, setCountedCatalogue] = useState<CountedImage[]>([]);
  const [addExtraVisible, setAddExtraVisible] = useState(false);
  const [addCountedVisible, setAddCountedVisible] = useState(false);
  const [countedQtys, setCountedQtys] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Image.getSize(absoluteUri(backgroundPath), (w, h) => {
      setNat({ w, h });
      setEx(Math.round(w * 0.3));
      setEy(Math.round(h * 0.62));
      setWrX(Math.round(w * 0.1));
      setWrY(Math.round(h * 0.75));
      setSh(Math.min(800, Math.max(100, Math.round(h * 0.28))));
      setWrH(Math.min(600, Math.max(100, Math.round(h * 0.2))));
    });
  }, [backgroundPath]);

  useEffect(() => {
    otherImageRepo.list({ status: 'ACTIVE' }).then(setOtherImages);
    countedImageRepo.list({ status: 'ACTIVE' }).then(setCountedCatalogue);
  }, []);

  function onContainerLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  const hasWinRate = winRateItems.length > 0;
  const rowItems = merged ? [...items, ...winRateItems.map((w) => ({ path: w.imagePath }))] : items;

  function addExtra(img: OtherImage) {
    const rw = Math.round(Math.min(200, Math.max(80, nat.w * 0.12)));
    setExtras((prev) => [
      ...prev,
      {
        id: Crypto.randomUUID(),
        name: img.name,
        imagePath: img.image_path,
        x: Math.round(nat.w * 0.08),
        y: Math.round(nat.h * 0.08),
        width: rw,
        height: 0,
        scale: 1,
        borderSize: 0,
        borderPadding: 0,
        borderColor: '#ffffff',
        opacity: 1,
        zIndex: 10 + prev.length,
      },
    ]);
    setAddExtraVisible(false);
    setActive('e-' + img.id);
  }

  function updateExtra(id: string, patch: Partial<ExtraLayerState>) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function deleteExtra(id: string) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
    if (active === 'e-' + id) setActive('skin');
  }
  function moveExtraZ(id: string, dir: number) {
    setExtras((prev) => {
      const arr = [...prev];
      const i = arr.findIndex((e) => e.id === id);
      const t = i + dir;
      if (i === -1 || t < 0 || t >= arr.length) return prev;
      const tmp = arr[i].zIndex;
      arr[i] = { ...arr[i], zIndex: arr[t].zIndex };
      arr[t] = { ...arr[t], zIndex: tmp };
      return arr;
    });
  }

  function addCounted(img: CountedImage) {
    const qty = Number(countedQtys[img.id] ?? img.default_quantity) || 0;
    if (qty <= 0) return;
    setCountedLayers((prev) => [
      ...prev,
      {
        id: Crypto.randomUUID(),
        name: img.name,
        imagePath: img.image_path,
        x: Math.round(nat.w * 0.1),
        y: Math.round(nat.h * 0.1),
        width: 90,
        quantity: qty,
        borderSize: 2,
        borderColor: '#ffffff',
        opacity: 1,
        zIndex: 20 + prev.length,
        text: { ...DEFAULT_COUNTED_TEXT },
      },
    ]);
    setAddCountedVisible(false);
    setActive(null);
  }

  function updateCounted(id: string, patch: Partial<CountedLayerState>) {
    setCountedLayers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteCounted(id: string) {
    setCountedLayers((prev) => prev.filter((c) => c.id !== id));
    if (active === 'c-' + id) setActive('skin');
  }

  async function handleSave() {
    setSaving(true);
    setMessage('Đang ghép ảnh...');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền lưu ảnh vào thư viện.');
        return;
      }

      const background = await loadSkImageFromPath(backgroundPath);

      const skinItems = await Promise.all(
        items.map(async (it) => {
          const image = await loadSkImageFromPath(it.imagePath);
          const button = it.useButton
            ? it.availableButtons.find((b) => b.id === it.selectedButtonId)
            : undefined;
          const kill = it.useKillNotification
            ? it.availableKillNotifications.find((k) => k.id === it.selectedKillNotificationId)
            : undefined;
          return {
            image,
            useButton: !!button,
            buttonImage: button ? await loadSkImageFromPath(button.image_path) : undefined,
            buttonPosition: 'center_pct_75',
            buttonWidthRatio: 0.35,
            useKillNotification: !!kill,
            killNotificationImage: kill ? await loadSkImageFromPath(kill.image_path) : undefined,
            killNotificationPosition: 'center_pct_50',
            killNotificationWidthRatio: 1,
          };
        })
      );

      const mergedWinRateItems = merged
        ? await Promise.all(
            winRateItems.map(async (w) => ({
              image: await loadSkImageFromPath(w.imagePath),
              useButton: false,
              buttonPosition: 'center_pct_75',
              buttonWidthRatio: 0.35,
              useKillNotification: false,
              killNotificationPosition: 'center_pct_50',
              killNotificationWidthRatio: 1,
            }))
          )
        : [];

      const winRateImages = merged
        ? []
        : await Promise.all(winRateItems.map((w) => loadSkImageFromPath(w.imagePath)));

      const extraLayersInput = await Promise.all(
        extras.map(async (e) => ({
          image: await loadSkImageFromPath(e.imagePath),
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
          scale: e.scale,
          borderSize: e.borderSize,
          borderPadding: e.borderPadding,
          borderColor: e.borderColor,
          opacity: e.opacity,
          zIndex: e.zIndex,
        }))
      );

      const countedLayersInput = await Promise.all(
        countedLayers.map(async (c) => ({
          image: await loadSkImageFromPath(c.imagePath),
          x: c.x,
          y: c.y,
          width: c.width,
          quantity: c.quantity,
          borderSize: c.borderSize,
          borderColor: c.borderColor,
          opacity: c.opacity,
          zIndex: c.zIndex,
          text: c.text,
        }))
      );

      const bytes = composeFinal({
        background,
        skinItems: [...skinItems, ...mergedWinRateItems],
        skinRow: {
          x: ex,
          y: ey,
          height: sh,
          gap: sg,
          borderSize: bs,
          borderPadding: bp,
          borderColor: bc,
          scale: ss,
          align: 'left',
          stretchFit: skinPlacement === 'below_background',
          zIndex: 5,
        },
        winRateImages,
        winRateRow: hasWinRate
          ? {
              x: wrX,
              y: wrY,
              height: wrH,
              gap: wrGap,
              borderSize: wrBs,
              borderPadding: wrBp,
              borderColor: wrBc,
              scale: wrSs,
              align: 'left',
              stretchFit: wrPlacement === 'below_background',
              zIndex: 6,
            }
          : null,
        skinPlacement,
        wrPlacement,
        merged,
        sectionGap,
        backgroundColor: '#000000',
        extras: extraLayersInput,
        countedLayers: countedLayersInput,
      });

      const tempPath = saveBytes(bytes, 'crop-sources', 'png');
      const tempUri = absoluteUri(tempPath);
      await MediaLibrary.Asset.create(tempUri);
      deleteImage(tempPath);

      setMessage('Đã lưu ảnh vào thư viện ảnh của máy.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi khi ghép ảnh');
    } finally {
      setSaving(false);
    }
  }

  const active_e = active?.startsWith('e-') ? extras.find((e) => 'e-' + e.id === active) : null;
  const active_c = active?.startsWith('c-') ? countedLayers.find((c) => 'c-' + c.id === active) : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.canvasWrap} onLayout={onContainerLayout}>
          {containerWidth > 0 && nat.w > 0 && (
            <View style={{ width: containerWidth, height: containerWidth * (nat.h / nat.w) }}>
              <Image source={{ uri: absoluteUri(backgroundPath) }} style={StyleSheet.absoluteFill} resizeMode="stretch" />

              <DraggableLayer
                x={ex}
                y={ey}
                scale={ds}
                onMove={(x, y) => {
                  setEx(Math.round(x));
                  setEy(Math.round(y));
                }}
                onPress={() => setActive('skin')}
                style={[styles.row, { padding: (bp + bs) * ds * ss, backgroundColor: bc }, active === 'skin' && styles.rowActive]}
              >
                {rowItems.map((it: any, i: number) => (
                  <Image
                    key={i}
                    source={{ uri: absoluteUri(it.path ?? it.imagePath) }}
                    resizeMode="contain"
                    style={{ height: sh * ds * ss, width: sh * ds * ss * 0.6, marginRight: i < rowItems.length - 1 ? sg * ds * ss : 0 }}
                  />
                ))}
              </DraggableLayer>

              {!merged && hasWinRate && (
                <DraggableLayer
                  x={wrX}
                  y={wrY}
                  scale={ds}
                  onMove={(x, y) => {
                    setWrX(Math.round(x));
                    setWrY(Math.round(y));
                  }}
                  onPress={() => setActive('wr')}
                  style={[styles.row, { padding: (wrBp + wrBs) * ds * wrSs, backgroundColor: wrBc }, active === 'wr' && styles.rowActive]}
                >
                  {winRateItems.map((it, i) => (
                    <Image
                      key={it.id}
                      source={{ uri: absoluteUri(it.imagePath) }}
                      resizeMode="contain"
                      style={{ height: wrH * ds * wrSs, width: wrH * ds * wrSs * 0.6, marginRight: i < winRateItems.length - 1 ? wrGap * ds * wrSs : 0 }}
                    />
                  ))}
                </DraggableLayer>
              )}

              {extras.map((e) => (
                <DraggableLayer
                  key={e.id}
                  x={e.x}
                  y={e.y}
                  scale={ds}
                  onMove={(x, y) => updateExtra(e.id, { x: Math.round(x), y: Math.round(y) })}
                  onPress={() => setActive('e-' + e.id)}
                  style={[
                    { width: e.width * ds * e.scale, opacity: e.opacity },
                    active === 'e-' + e.id && styles.layerActive,
                  ]}
                >
                  <Image source={{ uri: absoluteUri(e.imagePath) }} resizeMode="contain" style={{ width: '100%', height: e.height > 0 ? e.height * ds * e.scale : e.width * ds * e.scale }} />
                </DraggableLayer>
              ))}

              {countedLayers.map((c) => (
                <DraggableLayer
                  key={c.id}
                  x={c.x}
                  y={c.y}
                  scale={ds}
                  onMove={(x, y) => updateCounted(c.id, { x: Math.round(x), y: Math.round(y) })}
                  onPress={() => setActive('c-' + c.id)}
                  style={[{ width: c.width * ds, opacity: c.opacity }, active === 'c-' + c.id && styles.layerActive]}
                >
                  <Image source={{ uri: absoluteUri(c.imagePath) }} resizeMode="contain" style={{ width: '100%', height: c.width * ds }} />
                  <Text style={styles.qtyBadge}>{c.quantity}</Text>
                </DraggableLayer>
              ))}
            </View>
          )}
        </View>

        <View style={styles.toolbar}>
          {(active === 'skin' || !active) && (
            <>
              <PlacementRow label="Vị trí skin" value={skinPlacement} onChange={setSkinPlacement} />
              {hasWinRate && (
                <>
                  <PlacementRow label="Vị trí WR" value={wrPlacement} onChange={setWrPlacement} />
                  <SwitchField label="Gộp WR vào hàng skin" value={merged} onChange={setMerged} />
                </>
              )}
              <NumberField label="Chiều cao" value={sh} onChange={setSh} />
              <NumberField label="Tỉ lệ ×100" value={Math.round(ss * 100)} onChange={(v) => setSs(v / 100)} />
              <NumberField label="Khoảng cách" value={sg} onChange={setSg} />
              <NumberField label="Viền" value={bs} onChange={setBs} />
              <NumberField label="Đệm viền" value={bp} onChange={setBp} />
              <ColorField label="Màu viền" value={bc} onChange={setBc} />
              {(skinPlacement === 'below_background' || merged) && (
                <NumberField label="Gap dưới nền" value={sectionGap} onChange={setSectionGap} />
              )}
            </>
          )}
          {active === 'wr' && (
            <>
              <NumberField label="Chiều cao" value={wrH} onChange={setWrH} />
              <NumberField label="Tỉ lệ ×100" value={Math.round(wrSs * 100)} onChange={(v) => setWrSs(v / 100)} />
              <NumberField label="Khoảng cách" value={wrGap} onChange={setWrGap} />
              <NumberField label="Viền" value={wrBs} onChange={setWrBs} />
              <NumberField label="Đệm viền" value={wrBp} onChange={setWrBp} />
              <ColorField label="Màu viền" value={wrBc} onChange={setWrBc} />
            </>
          )}
          {active_e && (
            <>
              <NumberField label="Rộng" value={active_e.width} onChange={(v) => updateExtra(active_e.id, { width: v })} />
              <NumberField label="Cao (0=auto)" value={active_e.height} onChange={(v) => updateExtra(active_e.id, { height: v })} />
              <NumberField label="Tỉ lệ ×100" value={Math.round(active_e.scale * 100)} onChange={(v) => updateExtra(active_e.id, { scale: v / 100 })} />
              <NumberField label="Viền" value={active_e.borderSize} onChange={(v) => updateExtra(active_e.id, { borderSize: v })} />
              <NumberField label="Đệm viền" value={active_e.borderPadding} onChange={(v) => updateExtra(active_e.id, { borderPadding: v })} />
              <ColorField label="Màu viền" value={active_e.borderColor} onChange={(v) => updateExtra(active_e.id, { borderColor: v })} />
              <NumberField label="Opacity ×100" value={Math.round(active_e.opacity * 100)} onChange={(v) => updateExtra(active_e.id, { opacity: v / 100 })} />
              <View style={styles.toolbarActions}>
                <Pressable style={styles.smallBtn} onPress={() => moveExtraZ(active_e.id, -1)}><Text style={styles.smallBtnText}>Lên lớp</Text></Pressable>
                <Pressable style={styles.smallBtn} onPress={() => moveExtraZ(active_e.id, 1)}><Text style={styles.smallBtnText}>Xuống lớp</Text></Pressable>
                <Pressable style={styles.smallBtnDanger} onPress={() => deleteExtra(active_e.id)}><Text style={styles.smallBtnDangerText}>Xoá</Text></Pressable>
              </View>
            </>
          )}
          {active_c && (
            <>
              <NumberField label="Số lượng" value={active_c.quantity} onChange={(v) => updateCounted(active_c.id, { quantity: v })} />
              <NumberField label="Rộng" value={active_c.width} onChange={(v) => updateCounted(active_c.id, { width: v })} />
              <NumberField label="Cỡ chữ" value={active_c.text.fontSize} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, fontSize: v } })} />
              <ColorField label="Màu chữ" value={active_c.text.fontColor} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, fontColor: v } })} />
              <ColorField label="Màu viền chữ" value={active_c.text.strokeColor} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, strokeColor: v } })} />
              <NumberField label="Viền chữ" value={active_c.text.strokeWidth} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, strokeWidth: v } })} />
              <NumberField label="Viền ảnh" value={active_c.borderSize} onChange={(v) => updateCounted(active_c.id, { borderSize: v })} />
              <ColorField label="Màu viền ảnh" value={active_c.borderColor} onChange={(v) => updateCounted(active_c.id, { borderColor: v })} />
              <Pressable style={styles.smallBtnDanger} onPress={() => deleteCounted(active_c.id)}><Text style={styles.smallBtnDangerText}>Xoá</Text></Pressable>
            </>
          )}
        </View>

        <View style={styles.addRow}>
          <Pressable style={styles.addBtn} onPress={() => setAddExtraVisible(true)}>
            <Text style={styles.addBtnText}>+ Ảnh khác</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => setAddCountedVisible(true)}>
            <Text style={styles.addBtnText}>+ Ảnh số lượng</Text>
          </Pressable>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Lưu ảnh</Text>}
      </Pressable>

      <Modal visible={addExtraVisible} animationType="slide" transparent onRequestClose={() => setAddExtraVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Chọn ảnh khác</Text>
            <FlatList
              data={otherImages}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <Pressable style={styles.pickRow} onPress={() => addExtra(item)}>
                  <Image source={{ uri: absoluteUri(item.image_path) }} style={styles.pickThumb} />
                  <Text>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Chưa có ảnh nào trong danh mục Ảnh khác.</Text>}
            />
            <Pressable style={styles.closeSheet} onPress={() => setAddExtraVisible(false)}>
              <Text style={styles.closeSheetText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={addCountedVisible} animationType="slide" transparent onRequestClose={() => setAddCountedVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Chọn ảnh số lượng</Text>
            <FlatList
              data={countedCatalogue}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <View style={styles.pickRow}>
                  <Image source={{ uri: absoluteUri(item.image_path) }} style={styles.pickThumb} />
                  <Text style={{ flex: 1 }}>{item.name}</Text>
                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="number-pad"
                    value={countedQtys[item.id] ?? String(item.default_quantity)}
                    onChangeText={(t) => setCountedQtys((p) => ({ ...p, [item.id]: t }))}
                  />
                  <Pressable style={styles.smallBtn} onPress={() => addCounted(item)}>
                    <Text style={styles.smallBtnText}>Thêm</Text>
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Chưa có ảnh nào trong danh mục Ảnh số lượng.</Text>}
            />
            <Pressable style={styles.closeSheet} onPress={() => setAddCountedVisible(false)}>
              <Text style={styles.closeSheetText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PlacementRow({ label, value, onChange }: { label: string; value: Placement; onChange: (v: Placement) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.placementButtons}>
        <Pressable style={[styles.placementBtn, value === 'inside_background' && styles.placementBtnActive]} onPress={() => onChange('inside_background')}>
          <Text style={[styles.placementBtnText, value === 'inside_background' && styles.placementBtnTextActive]}>Trong nền</Text>
        </Pressable>
        <Pressable style={[styles.placementBtn, value === 'below_background' && styles.placementBtnActive]} onPress={() => onChange('below_background')}>
          <Text style={[styles.placementBtnText, value === 'below_background' && styles.placementBtnTextActive]}>Dưới nền</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => onChange(Number(t.replace(/[^0-9-]/g, '')) || 0)}
      />
    </View>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChange} autoCapitalize="none" />
    </View>
  );
}

function SwitchField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.field, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 12, paddingBottom: 90 },
  canvasWrap: { backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', borderRadius: 4 },
  rowActive: { outlineColor: '#3b82f6' } as any,
  layerActive: { borderWidth: 2, borderColor: '#3b82f6' },
  qtyBadge: { position: 'absolute', right: 2, bottom: 2, color: '#fff', fontWeight: '800', fontSize: 14 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, backgroundColor: '#fff', padding: 10, borderRadius: 8 },
  toolbarActions: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  field: { minWidth: 90 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 3, textTransform: 'uppercase' },
  fieldInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, minWidth: 70 },
  placementButtons: { flexDirection: 'row', gap: 6 },
  placementBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9' },
  placementBtnActive: { backgroundColor: '#dbeafe' },
  placementBtnText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  placementBtnTextActive: { color: '#1d4ed8' },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  addBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  message: { marginTop: 12, color: '#16a34a', fontSize: 13 },
  saveButton: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center', elevation: 3 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '75%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickThumb: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#e2e8f0' },
  qtyInput: { width: 50, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, textAlign: 'center' },
  emptyText: { color: '#94a3b8', padding: 16, textAlign: 'center' },
  closeSheet: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  closeSheetText: { color: '#2563eb', fontWeight: '700' },
  smallBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  smallBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  smallBtnDanger: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  smallBtnDangerText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
});
