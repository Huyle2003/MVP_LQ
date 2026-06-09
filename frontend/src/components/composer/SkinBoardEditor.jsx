import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Layers, Loader2, Maximize2, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react'
import { getOtherImages } from '../../services/otherImageService.js'
import { getCountedImages } from '../../services/countedImageService.js'
import { uploadImage } from '../../services/composeService.js'

const SZ = 5; const EZ = 10

export default function SkinBoardEditor({ backgroundUrl, bgObjectName, items, winRateItems, onSave, onBack }) {
  const bgRef = useRef(null); const ovRef = useRef(null); const wrRef = useRef(null)

  const [nat, setNat] = useState({ w: 1, h: 1 }); const [loaded, setLoaded] = useState(false)

  // Skin row
  const [ex, setEx] = useState(0); const [ey, setEy] = useState(0)
  const [sh, setSh] = useState(320); const [sg, setSg] = useState(0)
  const [bs, setBs] = useState(5); const [bp, setBp] = useState(4); const [bc, setBc] = useState('#ffffff')
  const [ss, setSs] = useState(1.0)

  // Win rate row (separate from skin when not merged)
  const [wrX, setWrX] = useState(0); const [wrY, setWrY] = useState(0)
  const [wrH, setWrH] = useState(200); const [wrGap, setWrGap] = useState(0)
  const [wrBs, setWrBs] = useState(5); const [wrBp, setWrBp] = useState(4); const [wrBc, setWrBc] = useState('#ffffff')
  const [wrSs, setWrSs] = useState(1.0)

  // Placement & merge
  const [skinPlacement, setSkinPlacement] = useState('inside_background')
  const [wrPlacement, setWrPlacement] = useState('inside_background')
  const [merged, setMerged] = useState(false)
  const [sectionGap, setSectionGap] = useState(0)
  const stretchFit = true // always stretch when below_background

  const [extras, setExtras] = useState([])
  const extraRefs = useRef({})
  const [active, setActive] = useState('skin')
  const [cat, setCat] = useState([]); const [catL, setCatL] = useState(false); const [catK, setCatK] = useState('')
  const [sv, setSv] = useState(false); const [drag, setDrag] = useState(false); const [upl, setUpl] = useState(false)
  const di = useRef(null)

  // ─── Counted images ──────────────────────────────
  const [countedCatalogue, setCountedCatalogue] = useState([])
  const [countedCatL, setCountedCatL] = useState(false)
  const [countedCatK, setCountedCatK] = useState('')
  const [countedLayers, setCountedLayers] = useState([])
  const [countedQtys, setCountedQtys] = useState({})
  const [sideTab, setSideTab] = useState('extra') // 'extra' | 'counted'

  const ds = loaded && bgRef.current && nat.w ? bgRef.current.getBoundingClientRect().width / nat.w : 1
  const dx = Math.round(ex * ds); const dy = Math.round(ey * ds)
  const bpx = Math.round((bp + bs) * ds * ss)
  const bgDH = loaded && bgRef.current ? bgRef.current.getBoundingClientRect().height : 0
  const dGap = Math.round(sectionGap * ds)
  const skinDy = skinPlacement === 'below_background' ? Math.round(bgDH + dGap) : dy

  // ─── Measure actual skin row height after below_background renders ──
  // MUST be before wrDy to avoid Temporal Dead Zone (TDZ)
  const [measuredSkinH, setMeasuredSkinH] = useState(0)
  useLayoutEffect(() => {
    if (skinPlacement === 'below_background' && ovRef.current) {
      setMeasuredSkinH(ovRef.current.offsetHeight)
    }
  }, [skinPlacement, sh, ss, items, winRateItems, merged]) // re-measure before paint

  const wrDy = wrPlacement === 'below_background'
    ? Math.round(bgDH + dGap + (skinPlacement === 'below_background' || merged ? (measuredSkinH || Math.round(sh * ds * ss)) + dGap : 0))
    : Math.round(wrY * ds)

  useEffect(() => { loadCat() }, [])
  async function loadCat() {
    try { setCatL(true); const d = await getOtherImages({ status: 'ACTIVE', keyword: catK || undefined }); setCat(d) }
    catch { }
    finally { setCatL(false) }
  }

  useEffect(() => { loadCountedCat() }, [])
  async function loadCountedCat() {
    try { setCountedCatL(true); const d = await getCountedImages({ status: 'ACTIVE', keyword: countedCatK || undefined }); setCountedCatalogue(d) }
    catch { }
    finally { setCountedCatL(false) }
  }

  function addCountedLayer(ci, qty) {
    if (!qty || qty <= 0) return
    const id = crypto.randomUUID()
    setCountedLayers(p => [...p, {
      id,
      counted_image_id: ci.id,
      name: ci.name,
      object_name: ci.image_object_name,
      image_url: ci.image_url,
      quantity: qty,
      x: 100, y: 100,
      width: 90,
      opacity: 1.0,
      z_index: 20 + p.length,
      text: { font_size: 32, font_color: '#ffffff', stroke_color: '#000000', stroke_width: 2, position: 'bottom_right', offset_x: -4, offset_y: -4 },
    }])
    setActive('c-' + id)
  }

  function updCounted(id, patch) { setCountedLayers(p => p.map(l => l.id === id ? { ...l, ...patch } : l)) }
  function delCounted(id) { setCountedLayers(p => p.filter(l => l.id !== id)); if (active === 'c-' + id) setActive('skin') }

  // ─── Skin drag ─────────────
  function sd(e) { e.stopPropagation(); e.target.setPointerCapture(e.pointerId); setActive('skin'); setDrag(true); di.current = { t: 'skin', sx: e.clientX, sy: e.clientY, ox: ex, oy: ey, s: ds } }
  function sm(e) { const d = di.current; if (!d || d.t !== 'skin') return; const ovw = ovRef.current ? ovRef.current.offsetWidth / d.s : 0; const ovh = ovRef.current ? ovRef.current.offsetHeight / d.s : 0; setEx(Math.round(Math.max(0, Math.min(nat.w - ovw, d.ox + (e.clientX - d.sx) / d.s)))); if (skinPlacement !== 'below_background') setEy(Math.round(Math.max(0, Math.min(nat.h - ovh, d.oy + (e.clientY - d.sy) / d.s)))) }
  function sup() { setDrag(false); di.current = null }
  function sc() { setDrag(false); di.current = null }

  // ─── WR drag ──────────────
  function wrd(e) { e.stopPropagation(); e.target.setPointerCapture(e.pointerId); setActive('wr'); setDrag(true); di.current = { t: 'wr', sx: e.clientX, sy: e.clientY, ox: wrX, oy: wrY, s: ds } }
  function wrm(e) { const d = di.current; if (!d || d.t !== 'wr') return; const ww = wrRef.current ? wrRef.current.offsetWidth / d.s : 0; const wh = wrRef.current ? wrRef.current.offsetHeight / d.s : 0; setWrX(Math.round(Math.max(0, Math.min(nat.w - ww, d.ox + (e.clientX - d.sx) / d.s)))); if (wrPlacement !== 'below_background') setWrY(Math.round(Math.max(0, Math.min(nat.h - wh, d.oy + (e.clientY - d.sy) / d.s)))) }

  // ─── Extra drag ────────────
  function exd(img) { return (e) => { e.stopPropagation(); e.target.setPointerCapture(e.pointerId); setActive('e-' + img.id); setDrag(true); di.current = { t: 'e', id: img.id, sx: e.clientX, sy: e.clientY, ox: img.x, oy: img.y, s: ds } } }
  function exm(e) { const d = di.current; if (!d || d.t !== 'e') return; setExtras(p => p.map(im => { if (im.id !== d.id) return im; const el = extraRefs.current[im.id]; if (!el) return im; const ew = el.offsetWidth / d.s; const eh = el.offsetHeight / d.s; return { ...im, x: Math.round(Math.max(0, Math.min(nat.w - ew, d.ox + (e.clientX - d.sx) / d.s))), y: Math.round(Math.max(0, Math.min(nat.h - eh, d.oy + (e.clientY - d.sy) / d.s))) }; })) }

  function addCat(ci) { const id = crypto.randomUUID(); const rw = Math.round(Math.min(200, Math.max(80, nat.w * 0.12))); setExtras(p => [...p, { id, oid: ci.id, name: ci.name, obj: ci.image_object_name, url: ci.image_url, x: Math.round(nat.w * 0.08), y: Math.round(nat.h * 0.08), w: rw, h: 0, sc: 1.0, op: 1, rot: 0, bs: 0, bp: 0, bc: '#ffffff', z: EZ + p.length }]); setActive('e-' + id) }
  async function handleUpload(e) { const f = e.target.files?.[0]; if (!f) return; setUpl(true); try { const r = await uploadImage(f); const id = crypto.randomUUID(); const rw = Math.round(Math.min(200, Math.max(80, nat.w * 0.12))); setExtras(p => [...p, { id, oid: null, name: f.name, obj: r.object_name, url: r.file_url, x: Math.round(nat.w * 0.08), y: Math.round(nat.h * 0.10), w: rw, h: 0, sc: 1.0, op: 1, rot: 0, bs: 0, bp: 0, bc: '#ffffff', z: EZ + p.length }]); setActive('e-' + id) } catch (err) { console.error(err) } finally { setUpl(false); e.target.value = '' } }
  function updExtra(id, patch) { setExtras(p => p.map(im => im.id === id ? { ...im, ...patch } : im)) }
  function delExtra(id) { setExtras(p => p.filter(im => im.id !== id)); if (active === 'e-' + id) setActive('skin') }
  function moveZ(id, dir) { setExtras(p => { const a = [...p]; const i = a.findIndex(x => x.id === id); if (i === -1) return p; const t = i + dir; if (t < 0 || t >= a.length) return p; const tmp = a[i].z; a[i] = { ...a[i], z: a[t].z }; a[t] = { ...a[t], z: tmp }; return a }) }
  // ─── Counted layer drag ────────────
  function cld(ci) { return (e) => { e.stopPropagation(); e.target.setPointerCapture(e.pointerId); setActive('c-' + ci.id); setDrag(true); di.current = { t: 'c', id: ci.id, sx: e.clientX, sy: e.clientY, ox: ci.x, oy: ci.y, s: ds } } }
  function clm(e) { const d = di.current; if (!d || d.t !== 'c') return; setCountedLayers(p => p.map(l => { if (l.id !== d.id) return l; return { ...l, x: Math.round(Math.max(0, Math.min(nat.w - l.width, d.ox + (e.clientX - d.sx) / d.s))), y: Math.round(Math.max(0, Math.min(nat.h - l.width, d.oy + (e.clientY - d.sy) / d.s))) }; })) }

  async function handleSave() {
    const ir = bgRef.current?.getBoundingClientRect(); const or = ovRef.current?.getBoundingClientRect(); const wr = wrRef.current?.getBoundingClientRect()
    if (!ir || !or) { console.warn('save: missing bg or ov ref'); return; }
    const r = nat.w / ir.width
    if (r <= 0 || !isFinite(r)) { console.warn('save: invalid ratio', r, nat.w, ir.width); return; }
    setSv(true)
    try {
      // Compute WR position from DOM if not merged and inside_background
      let wrRx = wrX, wrRy = wrY
      if (!merged && wrRef.current && wrPlacement === 'inside_background') {
        wrRx = Math.round((wr.left - ir.left) * r)
        wrRy = Math.round((wr.top - ir.top) * r)
      }
      const rowItemsAll = (items || []).map(it => ({ ...it, rowType: 'skin' }))
      const wrItems = (winRateItems || []).map(w => ({ ...w, rowType: 'win_rate' }))

      const wrHasItems = !merged && (wrItems?.length > 0)
      await onSave({
        compose_type: 'v2_editor_inside_background',
        background_object: bgObjectName,
        items: (merged ? [...rowItemsAll, ...wrItems] : rowItemsAll).map(it => ({
          skin_id: it.id, skin_object_name: it.skin_object_name || it.object_name,
          use_button: it.use_button || false, button_object_name: it.selected_button_object_name || null,
          use_kill_notification: it.use_kill_notification || false, kill_notification_object_name: it.selected_kill_notification_object_name || null,
          compose_mode: 'inside_skin', skin_height: it.skin_height || null,
        })),
        editor: {
          skin_placement: merged ? skinPlacement : skinPlacement,
          wr_placement: merged ? skinPlacement : wrPlacement,
          merged,
          section_gap: sectionGap,
          background_color: '#000000',
          skin_row: {
            x: Math.round((or.left - ir.left) * r), y: Math.round((or.top - ir.top) * r),
            skin_height: sh, skin_gap: sg, border_size: bs, border_padding: bp,
            border_color: bc, scale: ss, z_index: SZ, align: 'left',
            stretch_fit: skinPlacement === 'below_background',
          },
          win_rate_row: merged ? undefined : {
            x: wrRx, y: wrRy, skin_height: wrH, skin_gap: wrGap,
            border_size: wrBs, border_padding: wrBp, border_color: wrBc,
            scale: wrSs, z_index: 6, align: 'left',
            stretch_fit: wrPlacement === 'below_background',
          },
          extra_images: extras.map(im => ({ other_image_id: im.oid, object_name: im.obj, x: im.x, y: im.y, width: im.w, height: im.h, scale: im.sc, border_size: im.bs, border_padding: im.bp, border_color: im.bc, opacity: im.op, rotation: im.rot, z_index: im.z })),
          counted_image_layers: countedLayers.map(ci => ({
            counted_image_id: ci.counted_image_id, object_name: ci.object_name,
            quantity: ci.quantity, x: ci.x, y: ci.y, width: ci.width,
            opacity: ci.opacity, z_index: ci.z_index,
            text: { font_size: ci.text.font_size, font_color: ci.text.font_color, stroke_color: ci.text.stroke_color, stroke_width: ci.text.stroke_width, position: ci.text.position, offset_x: ci.text.offset_x, offset_y: ci.text.offset_y },
          })),
          overflow_mode: 'crop', // always crop to keep background fixed
        },
        win_rate_items: merged ? [] : wrItems.map(w => ({ object_name: w.object_name || w.skin_object_name })),
        options: { win_rate_enabled: wrHasItems },
      })
    } finally { setSv(false) }
  }

  const rowItems = useMemo(() => {
    const skins = (items || []).map(it => ({ ...it, rowType: 'skin' }))
    const wrs = (winRateItems || []).map(w => ({ id: w.temp_id || w.object_name, rowType: 'win_rate', skin_name: w.file_name || 'WR', skin_image_url: w.image_url, skin_object_name: w.object_name }))
    if (merged) return [...skins, ...wrs]
    return skins
  }, [items, winRateItems, merged])

  const wrRowItems = useMemo(() => {
    if (merged) return []
    return (winRateItems || []).map(w => ({ id: w.temp_id || w.object_name, rowType: 'win_rate', skin_image_url: w.image_url, skin_object_name: w.object_name }))
  }, [winRateItems, merged])

  const skinRow = useMemo(() => {
    if (!rowItems.length) return null
    const g = Math.round(sg * ds * ss); const h = Math.round(sh * ds * ss)
    if (h < 10) return null
    const stretch = skinPlacement === 'below_background' && bgRef.current
    const count = rowItems.length
    return rowItems.map((it, i) => (
      <img key={it.id + '-s' + i} src={it.skin_image_url} alt="" draggable={false}
        style={{ height: stretch ? 'auto' : h, width: stretch ? `${100/count}%` : 'auto', display: 'block', marginRight: i < rowItems.length - 1 ? g : 0, borderRadius: 2 }} />
    ))
  }, [rowItems, sh, sg, ds, ss, skinPlacement, merged])

  const wrRow = useMemo(() => {
    if (!wrRowItems.length) return null
    const g = Math.round(wrGap * ds * wrSs); const h = Math.round(wrH * ds * wrSs)
    if (h < 10) return null
    const stretch = wrPlacement === 'below_background' && bgRef.current
    const count = wrRowItems.length
    return wrRowItems.map((it, i) => (
      <img key={it.id + '-wr' + i} src={it.skin_image_url} alt="" draggable={false}
        style={{ height: stretch ? 'auto' : h, width: stretch ? `${100/count}%` : 'auto', display: 'block', marginRight: i < wrRowItems.length - 1 ? g : 0, borderRadius: 2 }} />
    ))
  }, [wrRowItems, wrH, wrGap, ds, wrSs, wrPlacement])

  const ae = active && active.startsWith('e-') ? extras.find(im => 'e-' + im.id === active) : null
  const ac = active && active.startsWith('c-') ? countedLayers.find(l => 'c-' + l.id === active) : null
  const fl = (mw = 100) => ({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: mw })
  const lb = { fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }
  const rg = { width: '100%', height: 4, accentColor: '#2563eb' }
  const fv = { fontSize: 10, color: '#94a3b8', textAlign: 'right', fontFamily: 'monospace' }
  const nm = { width: 56, height: 28, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 6px', fontSize: 12, textAlign: 'center' }
  const btn = (bg = '#f1f5f9', c = '#334155', b = '1px solid #d1d5db') => ({ height: 34, padding: '0 12px', borderRadius: 6, border: b, background: bg, color: c, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' })
  const btnP = { height: 34, padding: '0 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }
  const btnD = { height: 34, padding: '0 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Chỉnh sửa layout</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Kéo thả object. Click để chọn. Dùng toolbar để chỉnh.</p>
      </div>

      <div style={{ display: 'flex', minHeight: 400 }}>
        {/* Canvas */}
        <div style={{ flex: 1, maxHeight: '65vh', overflow: 'auto', background: '#1e293b', textAlign: 'center', position: 'relative' }}
          onPointerDown={() => { if (!drag) setActive(null) }}>
          <img ref={bgRef} src={backgroundUrl} alt="" style={{ display: 'block', width: '100%', height: 'auto' }}
            onLoad={(e) => { const nw = e.target.naturalWidth, nh = e.target.naturalHeight; setNat({ w: nw, h: nh }); setEx(Math.round(nw * 0.30)); setEy(Math.round(nh * 0.62)); setWrX(Math.round(nw * 0.10)); setWrY(Math.round(nh * 0.75)); setSh(Math.min(800, Math.max(100, Math.round(nh * 0.28)))); setWrH(Math.min(600, Math.max(100, Math.round(nh * 0.20)))); setLoaded(true) }} />

          {/* Skin row overlay */}
          <div ref={ovRef}
            style={{ position: 'absolute', left: dx, top: skinDy, width: skinPlacement === 'below_background' && bgRef.current ? bgRef.current.getBoundingClientRect().width : 'auto', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', touchAction: 'none', cursor: active === 'skin' && drag ? 'grabbing' : active === 'skin' ? 'grab' : 'default', padding: bpx, background: bc, borderRadius: Math.round(6 * ds * ss), outline: active === 'skin' ? '2px solid #3b82f6' : 'none', outlineOffset: 2 }}
            onPointerDown={sd} onPointerMove={sm} onPointerUp={sup} onPointerCancel={sc}>
            {skinRow}
          </div>

          {/* Win rate row overlay (when not merged) */}
          {!merged && wrRowItems.length > 0 && (
            <div ref={wrRef}
              style={{ position: 'absolute', left: Math.round(wrX * ds), top: wrDy, width: wrPlacement === 'below_background' && bgRef.current ? bgRef.current.getBoundingClientRect().width : 'auto', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', touchAction: 'none', cursor: active === 'wr' && drag ? 'grabbing' : active === 'wr' ? 'grab' : 'default', padding: Math.round((wrBp + wrBs) * ds * wrSs), background: wrBc, borderRadius: Math.round(6 * ds * wrSs), outline: active === 'wr' ? '2px solid #3b82f6' : 'none', outlineOffset: 2 }}
              onPointerDown={wrd} onPointerMove={wrm} onPointerUp={sup} onPointerCancel={sc}>
              {wrRow}
            </div>
          )}

          {/* Extra images */}
          {extras.map(im => { const isA = 'e-' + im.id === active; const sw = Math.round(im.w * ds * im.sc); const shIm = im.h > 0 ? Math.round(im.h * ds * im.sc) : 'auto'; const bpIm = Math.round((im.bs + im.bp) * ds * im.sc); return (
            <div key={im.id} ref={el => { if (el) extraRefs.current[im.id] = el; else delete extraRefs.current[im.id]; }} style={{ position: 'absolute', left: Math.round(im.x * ds), top: Math.round(im.y * ds), width: sw, height: shIm !== 'auto' ? shIm : 'auto', padding: im.bs > 0 ? bpIm : 0, background: im.bs > 0 ? im.bc : 'none', borderRadius: Math.round(4 * ds * im.sc), opacity: im.op, touchAction: 'none', outline: isA ? '2px solid #3b82f6' : 'none', outlineOffset: 2, cursor: drag ? 'grabbing' : 'grab' }}
              onPointerDown={exd(im)} onPointerMove={exm} onPointerUp={sup} onPointerCancel={sc}>
              <img src={im.url} alt="" draggable={false} style={{ width: '100%', height: im.h > 0 ? '100%' : 'auto', display: 'block', pointerEvents: 'none', borderRadius: Math.round(4 * ds * im.sc), objectFit: im.h > 0 ? 'fill' : 'contain' }} />
              {isA && <button onClick={(e) => { e.stopPropagation(); delExtra(im.id) }} style={{ position: 'absolute', top: -10, right: -10, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>×</button>}
            </div>
          )})}

          {/* Counted image layers */}
          {countedLayers.map(ci => { const isA = 'c-' + ci.id === active; const cw = Math.round(ci.width * ds); return (
            <div key={ci.id} style={{ position: 'absolute', left: Math.round(ci.x * ds), top: Math.round(ci.y * ds), width: cw, height: 'auto', opacity: ci.opacity, touchAction: 'none', outline: isA ? '2px solid #3b82f6' : 'none', outlineOffset: 2, cursor: drag ? 'grabbing' : 'grab' }}
              onPointerDown={cld(ci)} onPointerMove={clm} onPointerUp={sup} onPointerCancel={sc}>
              <img src={ci.image_url} alt="" draggable={false} style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }} />
              <span style={{ position: 'absolute', right: ci.text.offset_x, bottom: ci.text.offset_y, color: ci.text.font_color, fontWeight: 800, fontSize: Math.round(ci.text.font_size * ds), textShadow: `-${ci.text.stroke_width}px -${ci.text.stroke_width}px 0 ${ci.text.stroke_color},${ci.text.stroke_width}px -${ci.text.stroke_width}px 0 ${ci.text.stroke_color},-${ci.text.stroke_width}px ${ci.text.stroke_width}px 0 ${ci.text.stroke_color},${ci.text.stroke_width}px ${ci.text.stroke_width}px 0 ${ci.text.stroke_color}`, lineHeight: 1, pointerEvents: 'none' }}>{ci.quantity}</span>
              {isA && <button onClick={(e) => { e.stopPropagation(); delCounted(ci.id) }} style={{ position: 'absolute', top: -10, right: -10, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>×</button>}
            </div>
          )})}
        </div>

        {/* Side panel with tabs */}
        <div style={{ width: 250, borderLeft: '1px solid #e2e8f0', background: '#fafbfc', display: 'flex', flexDirection: 'column' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
            <button style={{ flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, border: 'none', background: sideTab === 'extra' ? '#dbeafe' : 'transparent', color: sideTab === 'extra' ? '#1d4ed8' : '#64748b', cursor: 'pointer' }} onClick={() => setSideTab('extra')}>Ảnh khác</button>
            <button style={{ flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, border: 'none', background: sideTab === 'counted' ? '#dbeafe' : 'transparent', color: sideTab === 'counted' ? '#1d4ed8' : '#64748b', cursor: 'pointer' }} onClick={() => setSideTab('counted')}>SLượng</button>
          </div>

          {sideTab === 'extra' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                <Search size={14} color="#94a3b8" />
                <input placeholder="Tìm ảnh..." value={catK} onChange={e => setCatK(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCat()} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, padding: '4px 0', background: 'transparent' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#16a34a', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}><ImagePlus size={14} /> Upload<input type="file" accept="image/*" onChange={handleUpload} hidden disabled={upl} /></label>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
                {catL ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}><Loader2 className="spin" size={20} /></div>
                : cat.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Không có ảnh</div>
                : cat.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', marginBottom: 2 }} onClick={() => addCat(c)}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#e2e8f0' }}><img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{c.code}</div></div>
                      <Plus size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
                    </div>
                  ))}
                {extras.length > 0 && <>
                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 12px' }} />
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', padding: '4px 12px', textTransform: 'uppercase' }}>Đã thêm ({extras.length})</div>
                  {extras.map(im => (
                    <div key={im.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', marginBottom: 2, background: 'e-' + im.id === active ? '#dbeafe' : 'transparent' }} onClick={() => setActive('e-' + im.id)}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#e2e8f0' }}><img src={im.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{im.name}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>Z:{im.z}</div></div>
                      <button style={{ width: 22, height: 22, border: 'none', borderRadius: 4, background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); moveZ(im.id, -1) }} title="Lên"><ArrowUp size={12} /></button>
                      <button style={{ width: 22, height: 22, border: 'none', borderRadius: 4, background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); moveZ(im.id, 1) }} title="Xuống"><ArrowDown size={12} /></button>
                      <button style={{ width: 22, height: 22, border: 'none', borderRadius: 4, background: '#fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); delExtra(im.id) }} title="Xoá"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </>}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                <Search size={14} color="#94a3b8" />
                <input placeholder="Tìm icon..." value={countedCatK} onChange={e => setCountedCatK(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCountedCat()} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, padding: '4px 0', background: 'transparent' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
                {countedCatL ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}><Loader2 className="spin" size={20} /></div>
                : countedCatalogue.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Không có ảnh</div>
                : countedCatalogue.map(c => {
                    const q = countedQtys[c.id] ?? c.default_quantity ?? 0
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, marginBottom: 2 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#e2e8f0' }}><img src={c.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="number" min={0} value={q} onChange={e => setCountedQtys(p => ({ ...p, [c.id]: Math.max(0, Number(e.target.value) || 0) }))} style={{ width: 50, height: 24, border: '1px solid #d1d5db', borderRadius: 4, padding: '0 4px', fontSize: 11, textAlign: 'center' }} />
                            <button style={{ height: 24, padding: '0 8px', borderRadius: 4, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }} onClick={() => { if (q > 0) addCountedLayer(c, q) }}>Thêm</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {countedLayers.length > 0 && <>
                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 12px' }} />
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', padding: '4px 12px', textTransform: 'uppercase' }}>Đã thêm ({countedLayers.length})</div>
                  {countedLayers.map(ci => (
                    <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', marginBottom: 2, background: 'c-' + ci.id === active ? '#dbeafe' : 'transparent' }} onClick={() => setActive('c-' + ci.id)}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#e2e8f0' }}><img src={ci.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ci.name} x{ci.quantity}</div></div>
                      <button style={{ width: 22, height: 22, border: 'none', borderRadius: 4, background: '#fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); delCounted(ci.id) }} title="Xoá"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {active === 'skin' || !active ? (
          <>
            <div style={fl(160)}><label style={lb}>Vị trí skin: {skinPlacement}</label>
              <button style={btn(skinPlacement === 'below_background' ? '#dbeafe' : '#f1f5f9', '#334155')} onClick={() => setSkinPlacement('below_background')}>Dưới nền</button>
              <button style={btn(skinPlacement === 'inside_background' ? '#dbeafe' : '#f1f5f9', '#334155')} onClick={() => setSkinPlacement('inside_background')}>Trong nền</button>
            </div>
            {!merged && winRateItems?.length > 0 && (
              <div style={fl(160)}><label style={lb}>Vị trí WR</label>
                <button style={btn(wrPlacement === 'below_background' ? '#dbeafe' : '#f1f5f9', '#334155')} onClick={() => setWrPlacement('below_background')}>Dưới nền</button>
                <button style={btn(wrPlacement === 'inside_background' ? '#dbeafe' : '#f1f5f9', '#334155')} onClick={() => setWrPlacement('inside_background')}>Trong nền</button>
              </div>
            )}
            {winRateItems?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 60 }}>
                <label style={lb}>Gộp</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={merged} onChange={e => setMerged(e.target.checked)} />{merged ? 'Bật' : 'Tắt'}</label>
              </div>
            )}

            <div style={fl(100)}><label style={lb}>K.thước</label><input type="range" min={100} max={800} value={sh} onChange={e => setSh(Number(e.target.value))} style={rg} /><span style={fv}>{sh}px</span></div>
            <div style={fl(100)}><label style={lb}>Scale</label><input type="range" min={0.3} max={3} step={0.05} value={ss} onChange={e => setSs(Math.round(Number(e.target.value)*100)/100)} style={rg} /><span style={fv}>{ss.toFixed(2)}x</span></div>
            <div style={fl(100)}><label style={lb}>Gap</label><input type="range" min={0} max={50} value={sg} onChange={e => setSg(Number(e.target.value))} style={rg} /><span style={fv}>{sg}px</span></div>
            <div style={fl(100)}><label style={lb}>Viền</label><input type="range" min={0} max={30} value={bs} onChange={e => setBs(Number(e.target.value))} style={rg} /><span style={fv}>{bs}px</span></div>
            <div style={fl(100)}><label style={lb}>Pad</label><input type="range" min={0} max={40} value={bp} onChange={e => setBp(Number(e.target.value))} style={rg} /><span style={fv}>{bp}px</span></div>
            <div style={fl(60)}><label style={lb}>Màu</label><input type="color" value={bc} onChange={e => setBc(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} /></div>
            <div style={fl(60)}><label style={lb}>Cố định</label><span style={{ fontSize: 12, color: '#64748b' }}>Bật</span></div>
            {(skinPlacement === 'below_background' || merged) && (
              <div style={fl(80)}><label style={lb}>Gap dưới</label><input type="number" min={0} max={200} value={sectionGap} onChange={e => setSectionGap(Number(e.target.value))} style={nm} /></div>
            )}
          </>
        ) : active === 'wr' ? (
          <>
            <div style={fl(160)}><label style={lb}>Vị trí WR</label>
              <button style={btn(wrPlacement === 'below_background' ? '#dbeafe' : '#f1f5f9', '#334155')} onClick={() => { setWrPlacement(p => p === 'inside_background' ? 'below_background' : 'inside_background'); }}>
                {wrPlacement === 'inside_background' ? 'Trong nền' : 'Dưới nền'} [{wrPlacement}]
              </button>
            </div>
            <div style={fl(100)}><label style={lb}>K.thước</label><input type="range" min={100} max={800} value={wrH} onChange={e => setWrH(Number(e.target.value))} style={rg} /><span style={fv}>{wrH}px</span></div>
            <div style={fl(100)}><label style={lb}>Scale</label><input type="range" min={0.3} max={3} step={0.05} value={wrSs} onChange={e => setWrSs(Math.round(Number(e.target.value)*100)/100)} style={rg} /><span style={fv}>{wrSs.toFixed(2)}x</span></div>
            <div style={fl(100)}><label style={lb}>Gap</label><input type="range" min={0} max={50} value={wrGap} onChange={e => setWrGap(Number(e.target.value))} style={rg} /><span style={fv}>{wrGap}px</span></div>
            <div style={fl(100)}><label style={lb}>Viền</label><input type="range" min={0} max={30} value={wrBs} onChange={e => setWrBs(Number(e.target.value))} style={rg} /><span style={fv}>{wrBs}px</span></div>
            <div style={fl(100)}><label style={lb}>Pad</label><input type="range" min={0} max={40} value={wrBp} onChange={e => setWrBp(Number(e.target.value))} style={rg} /><span style={fv}>{wrBp}px</span></div>
            <div style={fl(60)}><label style={lb}>Màu</label><input type="color" value={wrBc} onChange={e => setWrBc(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} /></div>
          </>
        ) : ac ? (
          <>
            <div style={fl(80)}><label style={lb}>Số lượng</label><input type="number" min={0} max={99999} value={ac.quantity} onChange={e => updCounted(ac.id, { quantity: Math.max(0, Number(e.target.value) || 0) })} style={nm} /></div>
            <div style={fl(100)}><label style={lb}>Rộng</label><input type="range" min={30} max={300} value={ac.width} onChange={e => updCounted(ac.id, { width: Number(e.target.value) })} style={rg} /><span style={fv}>{ac.width}px</span></div>
            <div style={fl(80)}><label style={lb}>Font</label><input type="number" min={8} max={200} value={ac.text.font_size} onChange={e => updCounted(ac.id, { text: { ...ac.text, font_size: Number(e.target.value) } })} style={nm} /></div>
            <div style={fl(60)}><label style={lb}>Màu</label><input type="color" value={ac.text.font_color} onChange={e => updCounted(ac.id, { text: { ...ac.text, font_color: e.target.value } })} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} /></div>
            <div style={fl(60)}><label style={lb}>Viền</label><input type="color" value={ac.text.stroke_color} onChange={e => updCounted(ac.id, { text: { ...ac.text, stroke_color: e.target.value } })} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} /></div>
            <div style={fl(100)}><label style={lb}>Stroke</label><input type="range" min={0} max={20} value={ac.text.stroke_width} onChange={e => updCounted(ac.id, { text: { ...ac.text, stroke_width: Number(e.target.value) } })} style={rg} /><span style={fv}>{ac.text.stroke_width}px</span></div>
            <button style={btnD} onClick={() => delCounted(ac.id)}><Trash2 size={16} /> Xoá</button>
          </>
        ) : ae ? (
          <>
            <div style={fl(100)}><label style={lb}>Rộng</label><input type="range" min={50} max={1000} value={ae.w} onChange={e => updExtra(ae.id, { w: Number(e.target.value) })} style={rg} /><span style={fv}>{ae.w}px</span></div>
            <div style={fl(80)}><label style={lb}>Cao</label><input type="number" min={0} max={3000} value={ae.h} placeholder="auto" onChange={e => updExtra(ae.id, { h: Number(e.target.value) })} style={nm} /></div>
            <div style={fl(100)}><label style={lb}>Scale</label><input type="range" min={0.2} max={5} step={0.05} value={ae.sc} onChange={e => updExtra(ae.id, { sc: Math.round(Number(e.target.value)*100)/100 })} style={rg} /><span style={fv}>{ae.sc.toFixed(2)}x</span></div>
            <div style={fl(60)}><label style={lb}>X</label><input type="number" min={0} value={ae.x} onChange={e => updExtra(ae.id, { x: Number(e.target.value) })} style={nm} /></div>
            <div style={fl(60)}><label style={lb}>Y</label><input type="number" min={0} value={ae.y} onChange={e => updExtra(ae.id, { y: Number(e.target.value) })} style={nm} /></div>
            <div style={fl(100)}><label style={lb}>Viền</label><input type="range" min={0} max={30} value={ae.bs} onChange={e => updExtra(ae.id, { bs: Number(e.target.value) })} style={rg} /><span style={fv}>{ae.bs}px</span></div>
            <div style={fl(100)}><label style={lb}>Pad</label><input type="range" min={0} max={40} value={ae.bp} onChange={e => updExtra(ae.id, { bp: Number(e.target.value) })} style={rg} /><span style={fv}>{ae.bp}px</span></div>
            <div style={fl(60)}><label style={lb}>Màu</label><input type="color" value={ae.bc} onChange={e => updExtra(ae.id, { bc: e.target.value })} style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }} /></div>
            <div style={fl(100)}><label style={lb}>Opacity</label><input type="range" min={0.1} max={1} step={0.05} value={ae.op} onChange={e => updExtra(ae.id, { op: Math.round(Number(e.target.value)*100)/100 })} style={rg} /><span style={fv}>{ae.op.toFixed(2)}</span></div>
            <button style={btn()} onClick={() => moveZ(ae.id, -1)}><ArrowUp size={16} /> Lên</button>
            <button style={btn()} onClick={() => moveZ(ae.id, 1)}><ArrowDown size={16} /> Xuống</button>
            <button style={btnD} onClick={() => delExtra(ae.id)}><Trash2 size={16} /> Xoá</button>
          </>
        ) : null}
      </div>

      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btn()} onClick={onBack}>← Quay lại</button>
        <button style={btn('transparent')} onClick={() => { setEx(Math.round(nat.w*0.30)); setEy(Math.round(nat.h*0.62)); setSh(Math.min(800,Math.max(100,Math.round(nat.h*0.28)))); setSg(0); setBs(5); setBp(4); setBc('#ffffff'); setSs(1.0); setSectionGap(0); setSkinPlacement('inside_background'); setWrPlacement('inside_background'); setMerged(false) }}>
          <RotateCcw size={16} /> Mặc định</button>
        <label style={{ ...btn('#e8f5e9', '#2e7d32'), cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ImagePlus size={16} /> Upload ảnh
          <input type="file" accept="image/*" onChange={handleUpload} hidden disabled={upl} />
        </label>
        <button style={btnP} onClick={handleSave} disabled={sv}>
          {sv ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          {sv ? 'Đang lưu...' : 'Lưu ảnh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '6px 16px 10px', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
        <span>Skin: {skinPlacement === 'below_background' ? `X=${ex} (dưới)` : `X=${ex} Y=${ey}`}</span>
        <span>WR: {!merged ? (wrPlacement === 'below_background' ? `X=${wrX} (dưới)` : `X=${wrX} Y=${wrY}`) : 'gộp'}</span>
        <span>Gốc: {nat.w}×{nat.h}</span>
      </div>
    </div>
  )
}
