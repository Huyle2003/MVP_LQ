import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';

import { countedImageRepo, otherImageRepo } from '../../db/db';
import { CountedImage, OtherImage } from '../../db/types';
import { absoluteUri, deleteImage, importImage, saveBytes } from '../../storage/fileStorage';
import { ComposeStackParamList } from '../../navigation/ComposeStack';
import { composeFinal, loadSkImageFromPath, CountedTextConfig } from './composeEngine';
import DraggableLayer from './DraggableLayer';
import SliderField from './SliderField';

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
  /** Source image's natural width/height ratio — used to size the "auto"
   * (height=0) preview box to the image's real shape instead of a square,
   * so the selection border wraps the visible pixels tightly. */
  aspectRatio: number;
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
  aspectRatio: number;
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

  // Skin row. "Viền" (bs) is the only user-facing border control now — it
  // covers what used to be two separate fields (border + border padding),
  // which both just added a same-colored margin and only ever differed by
  // being two numbers that summed together. bs defaults to the old bs+bp
  // total (5+4=9) so the default look is unchanged; bp is kept at 0 and
  // never exposed in the UI again, only still read by composeEngine/save.
  // Likewise "Chiều cao" (sh) is now the only size control — ss (scale) is
  // pinned at 1 instead of being a second, redundant size knob; sh's range
  // is widened to cover the size span that sh×ss used to reach.
  const [ex, setEx] = useState(0);
  const [ey, setEy] = useState(0);
  const [sh, setSh] = useState(320);
  const [sg, setSg] = useState(0);
  const [bs, setBs] = useState(9);
  const [bp, setBp] = useState(0);
  const [bc, setBc] = useState('#ffffff');
  const [ss, setSs] = useState(1);

  // Win rate row
  const [wrX, setWrX] = useState(0);
  const [wrY, setWrY] = useState(0);
  const [wrH, setWrH] = useState(200);
  const [wrGap, setWrGap] = useState(0);
  const [wrBs, setWrBs] = useState(9);
  const [wrBp, setWrBp] = useState(0);
  const [wrBc, setWrBc] = useState('#ffffff');
  const [wrSs, setWrSs] = useState(1);

  const [skinPlacement, setSkinPlacement] = useState<Placement>('inside_background');
  const [wrPlacement, setWrPlacement] = useState<Placement>('inside_background');
  const [merged, setMerged] = useState(false);
  const [sectionGap, setSectionGap] = useState(0);

  const [extras, setExtras] = useState<ExtraLayerState[]>([]);
  const [countedLayers, setCountedLayers] = useState<CountedLayerState[]>([]);
  const [active, setActive] = useState<string | null>('skin');

  const [sideTab, setSideTab] = useState<'extra' | 'counted'>('extra');
  const [otherImages, setOtherImages] = useState<OtherImage[]>([]);
  const [countedCatalogue, setCountedCatalogue] = useState<CountedImage[]>([]);
  const [catKeyword, setCatKeyword] = useState('');
  const [countedKeyword, setCountedKeyword] = useState('');
  const [countedQtys, setCountedQtys] = useState<Record<string, string>>({});
  const [uploadingExtra, setUploadingExtra] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // The canvas lives in its own fixed-height, independently-scrollable box
  // (mirrors the web editor's `maxHeight: 55vh; overflow: auto` canvas) —
  // this is what makes a "below background" row reachable: it always has
  // its own scrollbar instead of relying on the whole page growing, which
  // made the row effectively invisible before. Disabling this scroll while
  // a layer drag is active also stops Android's ScrollView from stealing
  // the touch mid-drag, which was the cause of the laggy/jumpy dragging.
  const [canvasScrollEnabled, setCanvasScrollEnabled] = useState(true);
  const canvasBoxHeight = Math.round(Dimensions.get('window').height * 0.42);

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
    const t = setTimeout(() => {
      otherImageRepo.list({ status: 'ACTIVE', keyword: catKeyword || undefined }).then(setOtherImages);
    }, 250);
    return () => clearTimeout(t);
  }, [catKeyword]);

  useEffect(() => {
    const t = setTimeout(() => {
      countedImageRepo.list({ status: 'ACTIVE', keyword: countedKeyword || undefined }).then(setCountedCatalogue);
    }, 250);
    return () => clearTimeout(t);
  }, [countedKeyword]);

  function onContainerLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  const hasWinRate = winRateItems.length > 0;
  const rowItems = merged ? [...items, ...winRateItems.map((w) => ({ path: w.imagePath }))] : items;

  function addExtra(img: OtherImage) {
    const rw = Math.round(Math.min(200, Math.max(80, nat.w * 0.12)));
    const id = Crypto.randomUUID();
    const base: ExtraLayerState = {
      id,
      name: img.name,
      imagePath: img.image_path,
      x: Math.round(nat.w * 0.08),
      y: Math.round(nat.h * 0.08),
      width: rw,
      height: 0,
      scale: 1,
      aspectRatio: 1,
      borderSize: 0,
      borderPadding: 0,
      borderColor: '#ffffff',
      opacity: 1,
      zIndex: 10 + extras.length,
    };
    setExtras((prev) => [...prev, base]);
    setActive('e-' + id);
    Image.getSize(
      absoluteUri(img.image_path),
      (w, h) => updateExtra(id, { aspectRatio: w / h }),
      () => {}
    );
  }

  async function handleUploadExtra() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingExtra(true);
    try {
      const asset = result.assets[0];
      const imagePath = await importImage(asset.uri, 'extras');
      const rw = Math.round(Math.min(200, Math.max(80, nat.w * 0.12)));
      const id = Crypto.randomUUID();
      setExtras((prev) => [
        ...prev,
        {
          id,
          name: asset.fileName ?? 'Ảnh tải lên',
          imagePath,
          x: Math.round(nat.w * 0.08),
          y: Math.round(nat.h * 0.1),
          width: rw,
          height: 0,
          scale: 1,
          aspectRatio: asset.width && asset.height ? asset.width / asset.height : 1,
          borderSize: 0,
          borderPadding: 0,
          borderColor: '#ffffff',
          opacity: 1,
          zIndex: 10 + extras.length,
        },
      ]);
      setActive('e-' + id);
    } finally {
      setUploadingExtra(false);
    }
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
    const id = Crypto.randomUUID();
    setCountedLayers((prev) => [
      ...prev,
      {
        id,
        name: img.name,
        imagePath: img.image_path,
        x: Math.round(nat.w * 0.1),
        y: Math.round(nat.h * 0.1),
        width: 90,
        aspectRatio: 1,
        quantity: qty,
        borderSize: 2,
        borderColor: '#ffffff',
        opacity: 1,
        zIndex: 20 + countedLayers.length,
        text: { ...DEFAULT_COUNTED_TEXT },
      },
    ]);
    Image.getSize(
      absoluteUri(img.image_path),
      (w, h) => updateCounted(id, { aspectRatio: w / h }),
      () => {}
    );
  }

  function updateCounted(id: string, patch: Partial<CountedLayerState>) {
    setCountedLayers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function deleteCounted(id: string) {
    setCountedLayers((prev) => prev.filter((c) => c.id !== id));
    if (active === 'c-' + id) setActive('skin');
  }

  function handleResetDefaults() {
    setEx(Math.round(nat.w * 0.3));
    setEy(Math.round(nat.h * 0.62));
    setSh(Math.min(800, Math.max(100, Math.round(nat.h * 0.28))));
    setSg(0);
    setBs(9);
    setBp(0);
    setBc('#ffffff');
    setSs(1);
    setSectionGap(0);
    setSkinPlacement('inside_background');
    setWrPlacement('inside_background');
    setMerged(false);
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
          x: skinDisplayX,
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
              x: wrDisplayX,
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

  // Below-background placement auto-stretches the whole row to span the
  // background's width (mirrors composeEngine's stretch() — the row is
  // composed at its normal size, bordered, then uniformly scaled so its
  // width == bg.width()). ASSUMED_AR approximates each skin card's aspect
  // ratio, same 0.6 assumption already used for the non-stretched preview
  // size below — good enough for a preview since the real save always uses
  // each image's true dimensions via composeEngine.
  const ASSUMED_AR = 0.6;
  const skinCount = rowItems.length;
  const skinContentW = ASSUMED_AR * sh * skinCount + sg * Math.max(0, skinCount - 1);
  const skinRowNaturalW = (skinContentW + 2 * (bs + bp)) * ss;
  const skinStretch = skinPlacement === 'below_background' && skinRowNaturalW > 0 ? nat.w / skinRowNaturalW : 1;
  const skinItemW = ASSUMED_AR * sh * ss * skinStretch;
  const skinItemH = sh * ss * skinStretch;
  const skinGapPx = sg * ss * skinStretch;
  const skinPadPx = (bs + bp) * ss * skinStretch;

  const wrCount = winRateItems.length;
  const wrContentW = ASSUMED_AR * wrH * wrCount + wrGap * Math.max(0, wrCount - 1);
  const wrRowNaturalW = (wrContentW + 2 * (wrBs + wrBp)) * wrSs;
  const wrStretch = wrPlacement === 'below_background' && wrRowNaturalW > 0 ? nat.w / wrRowNaturalW : 1;
  const wrItemW = ASSUMED_AR * wrH * wrSs * wrStretch;
  const wrItemH = wrH * wrSs * wrStretch;
  const wrGapPx = wrGap * wrSs * wrStretch;
  const wrPadPx = (wrBs + wrBp) * wrSs * wrStretch;

  // Below-background placement pins the row right under the background
  // (or under the skin row too, if both are below/merged) instead of at
  // its dragged (x, y) — mirrors composeEngine.composeFinal's belowMode
  // layout exactly, so the preview matches what actually gets saved.
  // All in original-image pixel space, same space DraggableLayer expects.
  // X is pinned to 0 too: once stretched, the row's width already equals
  // the background's full width, so there's no room left to slide it
  // left/right — dragging X in that state only pushed it out of view.
  const skinDisplayX = skinPlacement === 'below_background' ? 0 : ex;
  const skinDisplayY = skinPlacement === 'below_background' ? nat.h + sectionGap : ey;
  const estimatedSkinRowHeight = skinItemH + 2 * skinPadPx;
  const estimatedWrRowHeight = wrItemH + 2 * wrPadPx;
  const wrDisplayX = wrPlacement === 'below_background' ? 0 : wrX;
  const wrDisplayY =
    wrPlacement === 'below_background'
      ? nat.h + sectionGap + (skinPlacement === 'below_background' || merged ? estimatedSkinRowHeight + sectionGap : 0)
      : wrY;

  // The preview canvas must grow taller than the background whenever a row
  // is placed below it — otherwise that row renders outside the clipped
  // container and becomes invisible/undraggable, even though it's still
  // there and still gets saved correctly. Mirrors composeEngine's belowMode
  // canvas-height math.
  const belowMode = skinPlacement === 'below_background' || wrPlacement === 'below_background' || merged;
  let canvasHeightImg = nat.h;
  if (belowMode) {
    if (skinPlacement === 'below_background') canvasHeightImg += sectionGap + estimatedSkinRowHeight;
    if (!merged && wrPlacement === 'below_background' && hasWinRate) canvasHeightImg += sectionGap + estimatedWrRowHeight;
    if (merged && skinPlacement === 'below_background') canvasHeightImg = nat.h + sectionGap + estimatedSkinRowHeight;
  }

  function pauseCanvasScroll() {
    setCanvasScrollEnabled(false);
  }
  function resumeCanvasScroll() {
    setCanvasScrollEnabled(true);
  }

  return (
    <View style={styles.container}>
      {/* Canvas: a fixed-height box with its OWN scroll (mirrors the web
          editor's `maxHeight: 55vh; overflow: auto`) instead of letting the
          whole page grow to fit a "below background" row — that row is now
          always reachable via this box's own scrollbar. It's a sibling of
          the settings ScrollView below, not nested inside it, so there's no
          ScrollView-inside-ScrollView gesture ambiguity. */}
      <View style={[styles.canvasWrap, { height: canvasBoxHeight }]} onLayout={onContainerLayout}>
        <ScrollView style={styles.canvasScroll} scrollEnabled={canvasScrollEnabled} nestedScrollEnabled>
          {containerWidth > 0 && nat.w > 0 && (
            <View style={{ width: containerWidth, height: containerWidth * (canvasHeightImg / nat.w) }}>
              <Image
                source={{ uri: absoluteUri(backgroundPath) }}
                style={{ position: 'absolute', top: 0, left: 0, width: containerWidth, height: containerWidth * (nat.h / nat.w) }}
                resizeMode="stretch"
              />

              <DraggableLayer
                x={skinDisplayX}
                y={skinDisplayY}
                scale={ds}
                onMove={(x, y) => {
                  if (skinPlacement !== 'below_background') {
                    setEx(Math.round(x));
                    setEy(Math.round(y));
                  }
                }}
                onPress={() => setActive('skin')}
                onDragStart={pauseCanvasScroll}
                onDragEnd={resumeCanvasScroll}
                style={[styles.row, { padding: skinPadPx * ds, backgroundColor: bc }, active === 'skin' && styles.rowActive]}
              >
                {rowItems.map((it: any, i: number) => (
                  <Image
                    key={i}
                    source={{ uri: absoluteUri(it.path ?? it.imagePath) }}
                    resizeMode="contain"
                    style={{ height: skinItemH * ds, width: skinItemW * ds, marginRight: i < rowItems.length - 1 ? skinGapPx * ds : 0 }}
                  />
                ))}
              </DraggableLayer>

              {!merged && hasWinRate && (
                <DraggableLayer
                  x={wrDisplayX}
                  y={wrDisplayY}
                  scale={ds}
                  onMove={(x, y) => {
                    if (wrPlacement !== 'below_background') {
                      setWrX(Math.round(x));
                      setWrY(Math.round(y));
                    }
                  }}
                  onPress={() => setActive('wr')}
                  onDragStart={pauseCanvasScroll}
                  onDragEnd={resumeCanvasScroll}
                  style={[styles.row, { padding: wrPadPx * ds, backgroundColor: wrBc }, active === 'wr' && styles.rowActive]}
                >
                  {winRateItems.map((it, i) => (
                    <Image
                      key={it.id}
                      source={{ uri: absoluteUri(it.imagePath) }}
                      resizeMode="contain"
                      style={{ height: wrItemH * ds, width: wrItemW * ds, marginRight: i < winRateItems.length - 1 ? wrGapPx * ds : 0 }}
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
                  onDragStart={pauseCanvasScroll}
                  onDragEnd={resumeCanvasScroll}
                  style={[
                    { width: e.width * ds * e.scale, opacity: e.opacity },
                    active === 'e-' + e.id && styles.layerActive,
                  ]}
                >
                  <Image
                    source={{ uri: absoluteUri(e.imagePath) }}
                    resizeMode="contain"
                    style={{
                      width: '100%',
                      height: e.height > 0 ? e.height * ds * e.scale : (e.width * ds * e.scale) / e.aspectRatio,
                    }}
                  />
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
                  onDragStart={pauseCanvasScroll}
                  onDragEnd={resumeCanvasScroll}
                  style={[{ width: c.width * ds, opacity: c.opacity }, active === 'c-' + c.id && styles.layerActive]}
                >
                  <Image
                    source={{ uri: absoluteUri(c.imagePath) }}
                    resizeMode="contain"
                    style={{ width: '100%', height: (c.width * ds) / c.aspectRatio }}
                  />
                  <Text style={styles.qtyBadge}>{c.quantity}</Text>
                </DraggableLayer>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>Kéo object trên ảnh để đổi vị trí. Chạm để chọn rồi chỉnh bên dưới. Khung ảnh có thể kéo lên/xuống riêng nếu object nằm dưới nền.</Text>

        {/* ── Tabs + horizontal strip (mirrors the web editor's bottom panel) ── */}
        <View style={styles.tabBar}>
          <Pressable style={[styles.tabBtn, sideTab === 'extra' && styles.tabBtnActive]} onPress={() => setSideTab('extra')}>
            <Text style={[styles.tabBtnText, sideTab === 'extra' && styles.tabBtnTextActive]}>Ảnh khác</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, sideTab === 'counted' && styles.tabBtnActive]} onPress={() => setSideTab('counted')}>
            <Text style={[styles.tabBtnText, sideTab === 'counted' && styles.tabBtnTextActive]}>SLượng</Text>
          </Pressable>
        </View>

        {sideTab === 'extra' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.stripContent}>
            <View style={styles.stripSearchBox}>
              <Ionicons name="search-outline" size={13} color="#94a3b8" />
              <TextInput
                style={styles.stripSearchInput}
                placeholder="Tìm ảnh khác..."
                value={catKeyword}
                onChangeText={setCatKeyword}
              />
            </View>
            {otherImages.length === 0 && <Text style={styles.stripEmpty}>Không có ảnh</Text>}
            {otherImages.map((c) => (
              <Pressable key={c.id} style={styles.stripItem} onPress={() => addExtra(c)}>
                <Image source={{ uri: absoluteUri(c.image_path) }} style={styles.stripThumb} />
                <Text style={styles.stripItemText} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
            {extras.length > 0 && <View style={styles.stripDivider} />}
            {extras.map((e) => (
              <Pressable
                key={e.id}
                style={[styles.stripItem, active === 'e-' + e.id && styles.stripItemActive]}
                onPress={() => setActive('e-' + e.id)}
              >
                <Image source={{ uri: absoluteUri(e.imagePath) }} style={styles.stripThumb} />
                <Text style={styles.stripItemText} numberOfLines={1}>{e.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.stripContent}>
            <View style={styles.stripSearchBox}>
              <Ionicons name="search-outline" size={13} color="#94a3b8" />
              <TextInput
                style={styles.stripSearchInput}
                placeholder="Tìm ảnh số lượng..."
                value={countedKeyword}
                onChangeText={setCountedKeyword}
              />
            </View>
            {countedCatalogue.length === 0 && <Text style={styles.stripEmpty}>Không có ảnh</Text>}
            {countedCatalogue.map((c) => (
              <View key={c.id} style={styles.stripItem}>
                <Image source={{ uri: absoluteUri(c.image_path) }} style={styles.stripThumb} />
                <Text style={styles.stripItemText} numberOfLines={1}>{c.name}</Text>
                <View style={styles.stripQtyRow}>
                  <TextInput
                    style={styles.stripQtyInput}
                    keyboardType="number-pad"
                    value={countedQtys[c.id] ?? String(c.default_quantity)}
                    onChangeText={(t) => setCountedQtys((p) => ({ ...p, [c.id]: t }))}
                  />
                  <Pressable style={styles.stripAddBtn} onPress={() => addCounted(c)}>
                    <Text style={styles.stripAddBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {countedLayers.length > 0 && <View style={styles.stripDivider} />}
            {countedLayers.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.stripItem, active === 'c-' + c.id && styles.stripItemActive]}
                onPress={() => setActive('c-' + c.id)}
              >
                <Image source={{ uri: absoluteUri(c.imagePath) }} style={styles.stripThumb} />
                <Text style={styles.stripItemText} numberOfLines={1}>{c.name} x{c.quantity}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ── Context-sensitive toolbar ── */}
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
              <SliderField label="Kích thước" value={sh} min={30} max={2000} onChange={setSh} />
              <SliderField label="Khoảng cách" value={sg} min={0} max={50} onChange={setSg} />
              <SliderField label="Viền" value={bs} min={0} max={60} onChange={setBs} />
              <ColorField label="Màu viền" value={bc} onChange={setBc} />
              {(skinPlacement === 'below_background' || merged) && (
                <NumberField label="Gap dưới nền" value={sectionGap} onChange={setSectionGap} />
              )}
            </>
          )}
          {active === 'wr' && (
            <>
              <SliderField label="Kích thước" value={wrH} min={30} max={2000} onChange={setWrH} />
              <SliderField label="Khoảng cách" value={wrGap} min={0} max={50} onChange={setWrGap} />
              <SliderField label="Viền" value={wrBs} min={0} max={60} onChange={setWrBs} />
              <ColorField label="Màu viền" value={wrBc} onChange={setWrBc} />
            </>
          )}
          {active_e && (
            <>
              <SliderField label="Kích thước" value={active_e.width} min={30} max={2000} onChange={(v) => updateExtra(active_e.id, { width: v })} />
              <NumberField label="Cao (0=auto)" value={active_e.height} onChange={(v) => updateExtra(active_e.id, { height: v })} />
              <SliderField label="Viền" value={active_e.borderSize} min={0} max={60} onChange={(v) => updateExtra(active_e.id, { borderSize: v })} />
              <ColorField label="Màu viền" value={active_e.borderColor} onChange={(v) => updateExtra(active_e.id, { borderColor: v })} />
              <SliderField label="Opacity" value={active_e.opacity} min={0.1} max={1} step={0.05} onChange={(v) => updateExtra(active_e.id, { opacity: v })} displayValue={active_e.opacity.toFixed(2)} />
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
              <SliderField label="Rộng" value={active_c.width} min={30} max={300} onChange={(v) => updateCounted(active_c.id, { width: v })} />
              <NumberField label="Cỡ chữ" value={active_c.text.fontSize} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, fontSize: v } })} />
              <ColorField label="Màu chữ" value={active_c.text.fontColor} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, fontColor: v } })} />
              <ColorField label="Màu viền chữ" value={active_c.text.strokeColor} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, strokeColor: v } })} />
              <SliderField label="Viền chữ" value={active_c.text.strokeWidth} min={0} max={20} onChange={(v) => updateCounted(active_c.id, { text: { ...active_c.text, strokeWidth: v } })} />
              <SliderField label="Viền ảnh" value={active_c.borderSize} min={0} max={20} onChange={(v) => updateCounted(active_c.id, { borderSize: v })} />
              <ColorField label="Màu viền ảnh" value={active_c.borderColor} onChange={(v) => updateCounted(active_c.id, { borderColor: v })} />
              <Pressable style={styles.smallBtnDanger} onPress={() => deleteCounted(active_c.id)}><Text style={styles.smallBtnDangerText}>Xoá</Text></Pressable>
            </>
          )}
        </View>

        <View style={styles.bottomActions}>
          <View style={styles.bottomActionRow}>
            <Pressable style={styles.resetBtn} onPress={handleResetDefaults}>
              <Text style={styles.resetBtnText}>↺ Mặc định</Text>
            </Pressable>
            <Pressable style={styles.uploadBtn} onPress={handleUploadExtra} disabled={uploadingExtra}>
              {uploadingExtra ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <Text style={styles.uploadBtnText}>+ Upload ảnh</Text>
              )}
            </Pressable>
          </View>
          <Text style={styles.positionReadout}>
            Skin: {skinPlacement === 'below_background' ? 'tự khớp dưới nền' : `X=${ex} Y=${ey}`}
            {hasWinRate
              ? `  ·  WR: ${merged ? 'gộp' : wrPlacement === 'below_background' ? 'tự khớp dưới nền' : `X=${wrX} Y=${wrY}`}`
              : ''}
          </Text>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Lưu ảnh</Text>}
      </Pressable>
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

const PRESET_COLORS = [
  '#ffffff', '#000000', '#94a3b8', '#334155',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={[styles.field, { minWidth: 220 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.swatchRow}>
        {PRESET_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={[styles.swatch, { backgroundColor: c }, value.toLowerCase() === c && styles.swatchActive]}
          />
        ))}
        <TextInput
          style={[styles.fieldInput, styles.swatchInput]}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          placeholder="#rrggbb"
        />
      </View>
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
  settingsScroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 90 },
  canvasWrap: { backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden', marginHorizontal: 12, marginTop: 12 },
  canvasScroll: { flex: 1 },
  row: { flexDirection: 'row', borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
  rowActive: { borderColor: '#3b82f6' },
  layerActive: { borderWidth: 2, borderColor: '#3b82f6' },
  qtyBadge: { position: 'absolute', right: 2, bottom: 2, color: '#fff', fontWeight: '800', fontSize: 14 },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: 6 },

  tabBar: { flexDirection: 'row', marginTop: 12, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#2563eb' },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#1d4ed8' },
  stripScroll: { marginTop: 8 },
  stripContent: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 },
  stripSearchBox: {
    width: 130,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  stripSearchInput: { flex: 1, paddingVertical: 6, fontSize: 12 },
  stripEmpty: { fontSize: 12, color: '#94a3b8' },
  stripItem: { width: 76, alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  stripItemActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  stripThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e2e8f0' },
  stripItemText: { fontSize: 10, color: '#334155', marginTop: 4, textAlign: 'center' },
  stripDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#e2e8f0' },
  stripQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  stripQtyInput: { width: 34, height: 22, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, fontSize: 10, textAlign: 'center', padding: 0 },
  stripAddBtn: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  stripAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, lineHeight: 14 },

  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, backgroundColor: '#fff', padding: 10, borderRadius: 8 },
  toolbarActions: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  field: { minWidth: 90 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 3, textTransform: 'uppercase' },
  fieldInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, minWidth: 70 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  swatchActive: { borderWidth: 2, borderColor: '#2563eb' },
  swatchInput: { minWidth: 90, marginTop: 4 },
  placementButtons: { flexDirection: 'row', gap: 6 },
  placementBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9' },
  placementBtnActive: { backgroundColor: '#dbeafe' },
  placementBtnText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  placementBtnTextActive: { color: '#1d4ed8' },

  bottomActions: { marginTop: 14, gap: 8 },
  bottomActionRow: { flexDirection: 'row', gap: 10 },
  resetBtn: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, justifyContent: 'center' },
  resetBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  uploadBtn: { backgroundColor: '#dcfce7', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, justifyContent: 'center', minWidth: 90, alignItems: 'center' },
  uploadBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 12 },
  positionReadout: { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' },

  message: { marginTop: 12, color: '#16a34a', fontSize: 13 },
  saveButton: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center', elevation: 3 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  smallBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  smallBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  smallBtnDanger: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  smallBtnDangerText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
});
