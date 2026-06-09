import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'

import { getHeroes, getHeroSkins } from '../services/heroService.js'
import { getSkinButtons } from '../services/skinButtonService.js'
import { getSkinKillNotifications } from '../services/skinKillNotificationService.js'
import SkinBoardEditor from '../components/composer/SkinBoardEditor.jsx'
import {
  createSkinBoardComposeJob,
  getJob,
  uploadImage,
} from '../services/composeService.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForResult(jobId, setMsg) {
  for (let i = 0; i < 60; i++) {
    const job = await getJob(jobId)
    if (job.status === 'COMPLETED') return job.result_url
    if (job.status === 'FAILED') throw new Error(job.error || 'Ghép ảnh thất bại')
    setMsg(`Đang xử lý ảnh... (${job.status})`)
    await sleep(1000)
  }
  throw new Error('Job xử lý quá lâu')
}

export default function ComposerPage() {
  const [bgFile, setBgFile] = useState(null)
  const [bgPreview, setBgPreview] = useState('')
  const [bgObjectName, setBgObjectName] = useState('')

  const [heroes, setHeroes] = useState([])
  const [heroKeyword, setHeroKeyword] = useState('')
  const [selectedHero, setSelectedHero] = useState(null)
  const [skins, setSkins] = useState([])
  const [loadingSkins, setLoadingSkins] = useState(false)
  const [showHeroDropdown, setShowHeroDropdown] = useState(false)

  // Each selected skin entry stores extra data
  const [selectedItems, setSelectedItems] = useState([])

  const [skinTargetHeight, setSkinTargetHeight] = useState(330)
  const [skinGap, setSkinGap] = useState(0)
  const [skinMarginTop, setSkinMarginTop] = useState(0)
  const [gapColor, setGapColor] = useState('#000000')

  // ─── Win rate images ─────────────────────
  const [winRateItems, setWinRateItems] = useState([])
  const [uploadingWr, setUploadingWr] = useState(false)

  // ─── Editor mode ─────────────────────────────
  const [editorMode, setEditorMode] = useState(false)
  const [bgImageUrl, setBgImageUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [uploadingBg, setUploadingBg] = useState(false)

  useEffect(() => { loadHeroes() }, [])
  useEffect(() => { const t = setTimeout(() => loadHeroes(), 300); return () => clearTimeout(t) }, [heroKeyword])

  async function loadHeroes() {
    try { setHeroes(await getHeroes({ keyword: heroKeyword || undefined })) } catch {}
  }

  function handleBgChange(e) {
    const f = e.target.files?.[0] || null
    setBgFile(f); setBgPreview(f ? URL.createObjectURL(f) : '')
    setBgObjectName(''); setResultUrl(''); setMessage('')
  }
  async function handleUploadBg() {
    if (!bgFile) return
    try {
      setUploadingBg(true)
      const r = await uploadImage(bgFile)
      setBgObjectName(r.object_name)
      setBgImageUrl(r.file_url)
      setMessage('Đã upload ảnh nền')
    }
    catch (err) { setMessage(err.message || 'Upload thất bại') }
    finally { setUploadingBg(false) }
  }

  function handleSelectHero(hero) {
    setSelectedHero(hero); setHeroKeyword(''); setShowHeroDropdown(false); loadSkins(hero.id)
  }
  async function loadSkins(heroId) {
    try { setLoadingSkins(true); setSkins(await getHeroSkins(heroId)) } catch { setSkins([]) }
    finally { setLoadingSkins(false) }
  }

  // When adding a skin, fetch buttons + kill notifications
  async function handleAddSkin(skin) {
    if (selectedItems.some(s => s.id === skin.id)) return
    let buttons = [], killNtfs = []
    try { buttons = await getSkinButtons({ skin_id: skin.id, status: 'ACTIVE' }) } catch {}
    try { killNtfs = await getSkinKillNotifications({ skin_id: skin.id, status: 'ACTIVE' }) } catch {}

    setSelectedItems(prev => [...prev, {
      id: skin.id,
      hero_name: selectedHero?.name || '',
      skin_name: skin.name,
      skin_object_name: skin.image_object_name,
      skin_image_url: skin.image_url,
      available_buttons: buttons,
      use_button: false,
      selected_button_id: null,
      selected_button_object_name: null,
      available_kill_notifications: killNtfs,
      use_kill_notification: false,
      selected_kill_notification_id: null,
      selected_kill_notification_object_name: null,
      compose_mode: 'inside_skin',
      skin_height: skinTargetHeight,
    }])
  }

  function updateItem(id, patch) {
    setSelectedItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function handleRemoveItem(id) {
    setSelectedItems(prev => prev.filter(it => it.id !== id))
  }

  function handleMoveItem(index, dir) {
    const arr = [...selectedItems]; const t = index + dir
    if (t < 0 || t >= arr.length) return;
    [arr[index], arr[t]] = [arr[t], arr[index]]; setSelectedItems(arr)
  }

  // ─── Win rate handlers ─────────────────────
  async function handleUploadWr(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    try {
      setUploadingWr(true)
      for (const file of files) {
        const result = await uploadImage(file)
        setWinRateItems(prev => [...prev, {
          temp_id: crypto.randomUUID(),
          object_name: result.object_name,
          image_url: result.file_url,
          file_name: file.name,
        }])
      }
    } catch (err) { setMessage(err.message || 'Upload thất bại') }
    finally { setUploadingWr(false) }
  }

  function handleRemoveWr(tempId) {
    setWinRateItems(prev => prev.filter(i => i.temp_id !== tempId))
  }

  function handleMoveWr(index, dir) {
    const arr = [...winRateItems]
    const t = index + dir
    if (t < 0 || t >= arr.length) return;
    [arr[index], arr[t]] = [arr[t], arr[index]]
    setWinRateItems(arr)
  }

  // ─── Editor handlers ──────────────────────────
  function handleCreateLayout() {
    if (!bgObjectName) { setMessage('Upload ảnh nền trước'); return }
    if (selectedItems.length === 0 && winRateItems.length === 0) { setMessage('Chọn ít nhất một skin hoặc ảnh tỷ lệ thắng'); return }
    if (!bgImageUrl) { setMessage('Không có URL ảnh nền, upload lại'); return }
    setMessage('')
    setEditorMode(true)
  }

  async function handleEditorSave(payload) {
    setLoading(true); setResultUrl(''); setMessage('Đang tạo job...')
    try {
      const job = await createSkinBoardComposeJob(payload)
      const url = await waitForResult(job.job_id, setMessage)
      setResultUrl(url); setMessage('Ghép ảnh thành công')
    } catch (err) { setMessage(err.message || 'Có lỗi') }
    finally { setLoading(false) }
  }

  const bgPreviewUrl = useMemo(() => (bgFile ? URL.createObjectURL(bgFile) : ''), [bgFile])

  // ─── Render editor when in editor mode ──────
  if (editorMode) {
    return (
      <div className="page-section">
        <div className="page-header">
          <div><h2>Ghép skin - Chỉnh sửa layout</h2></div>
        </div>
        <SkinBoardEditor
          backgroundUrl={bgImageUrl}
          bgObjectName={bgObjectName}
          items={selectedItems}
          winRateItems={winRateItems}
          onSave={handleEditorSave}
          onBack={() => setEditorMode(false)}
        />
        {message && (
          <div className={`message ${message.includes('thành công') && !message.includes('Đang') ? '' : 'error'}`}
            style={{ marginTop: 16 }}>
            {message}
          </div>
        )}
        {resultUrl && (
          <section className="result" style={{ marginTop: 24 }}>
            <h3>Kết quả</h3>
            <img src={resultUrl} alt="Kết quả" />
            <a href={resultUrl} target="_blank" rel="noreferrer">Mở ảnh kết quả</a>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="page-section">
      <div className="page-header">
        <div><h2>Ghép skin</h2><p>Upload ảnh nền, chọn nhiều skin, tuỳ chọn thêm nút bấm & thông báo hạ.</p></div>
      </div>

      {/* ═══ Section 1: Background ═══ */}
      <div className="composer-card">
        <h3 className="composer-section-title">1. Ảnh nền</h3>
        <div className="composer-bg-row">
          <div className="composer-bg-upload">
            <label className="crop-upload-btn">
              <ImagePlus size={18} /><span>Chọn ảnh nền</span>
              <input type="file" accept="image/*" onChange={handleBgChange} hidden />
            </label>
            {bgFile && !bgObjectName && (
              <button className="crop-crop-btn" onClick={handleUploadBg} disabled={uploadingBg}>
                {uploadingBg ? <Loader2 className="spin" size={18} /> : null}
                {uploadingBg ? 'Đang upload...' : 'Upload ảnh nền'}
              </button>
            )}
            {bgObjectName && <span className="composer-uploaded-badge">✓ Đã upload</span>}
          </div>
          {bgObjectName && <div className="composer-object-name">{bgObjectName}</div>}
        </div>
        {bgPreviewUrl && <div className="composer-bg-preview"><img src={bgPreviewUrl} alt="Bg" /></div>}
      </div>

      {/* ═══ Section 2: Select skins ═══ */}
      <div className="composer-card">
        <h3 className="composer-section-title">2. Chọn skin từ danh mục</h3>
        <div className="composer-hero-search">
          <div className="composer-hero-search-inner">
            <input type="text" placeholder="Tìm kiếm tướng..." value={heroKeyword}
              onFocus={() => setShowHeroDropdown(true)}
              onChange={e => { setHeroKeyword(e.target.value); setShowHeroDropdown(true) }} />
            <ChevronDown size={16} />
          </div>
          {showHeroDropdown && (
            <div className="composer-hero-dropdown">
              {heroes.length === 0
                ? <div className="hero-dropdown-empty">Không tìm thấy tướng</div>
                : heroes.map(h => (
                    <div key={h.id} className={`hero-dropdown-item ${selectedHero?.id === h.id ? 'active' : ''}`}
                      onClick={() => handleSelectHero(h)}>
                      <span className="hero-dropdown-name">{h.name}</span>
                      <span className="hero-dropdown-code">{h.skin_count} skin</span>
                    </div>
                  ))}
            </div>
          )}
          {selectedHero && (
            <div className="composer-selected-hero">
              Đã chọn: <strong>{selectedHero.name}</strong>
              <button className="composer-clear-hero" onClick={() => { setSelectedHero(null); setSkins([]) }}><X size={14} /></button>
            </div>
          )}
        </div>
        {selectedHero && (
          <div className="composer-skin-grid">
            {loadingSkins
              ? <div className="skin-loading"><Loader2 className="spin" size={24} /></div>
              : skins.length === 0
                ? <div className="empty-state small"><p>Tướng này chưa có skin</p></div>
                : skins.filter(s => s.status === 'ACTIVE').map(skin => {
                    const added = selectedItems.some(s => s.id === skin.id)
                    return (
                      <div key={skin.id} className={`composer-skin-card ${added ? 'added' : ''}`}>
                        <div className="composer-skin-card-img"><img src={skin.image_url} alt={skin.name} /></div>
                        <div className="composer-skin-card-info">
                          <div className="composer-skin-card-name">{selectedHero.name}</div>
                          <div className="composer-skin-card-skin">{skin.name}</div>
                        </div>
                        <button className="composer-skin-card-btn" disabled={added} onClick={() => handleAddSkin(skin)}>
                          {added ? '✓ Đã chọn' : '+ Chọn skin'}
                        </button>
                      </div>
                    )
                  })
            }
          </div>
        )}
      </div>

      {/* ═══ Section 3: Selected skins with overlays ═══ */}
      <div className="composer-card">
        <h3 className="composer-section-title">3. Skin đã chọn ({selectedItems.length})</h3>
        {selectedItems.length === 0
          ? <div className="empty-state small"><p>Chưa chọn skin nào.</p></div>
          : <div className="composer-selected-list">
              {selectedItems.map((item, idx) => (
                <div key={item.id} className="composer-selected-item composer-selected-item-lg">
                  <div className="composer-selected-order">{idx + 1}</div>
                  <div className="composer-selected-img"><img src={item.skin_image_url} alt={item.skin_name} /></div>
                  <div className="composer-selected-info">
                    <div className="composer-selected-name">{item.hero_name} - {item.skin_name}</div>

                    {/* Checkbox: Ghép nút bấm (chỉ hiển thị khi skin có nút) */}
                    {item.available_buttons.length > 0 && (
                      <label className="composer-option-check">
                        <input type="checkbox" checked={item.use_button}
                          onChange={e => {
                            const checked = e.target.checked
                            const patch = { use_button: checked }
                            if (checked && !item.selected_button_id) {
                              const first = item.available_buttons[0]
                              patch.selected_button_id = first.id
                              patch.selected_button_object_name = first.image_object_name
                            }
                            updateItem(item.id, patch)
                          }} />
                        Ghép nút bấm
                      </label>
                    )}

                    {/* Checkbox: Ghép thông báo hạ (chỉ hiển thị khi skin có thông báo) */}
                    {item.available_kill_notifications.length > 0 && (
                      <label className="composer-option-check">
                        <input type="checkbox" checked={item.use_kill_notification}
                          onChange={e => {
                            const checked = e.target.checked
                            const patch = { use_kill_notification: checked }
                            if (checked && !item.selected_kill_notification_id) {
                              const first = item.available_kill_notifications[0]
                              patch.selected_kill_notification_id = first.id
                              patch.selected_kill_notification_object_name = first.image_object_name
                            }
                            updateItem(item.id, patch)
                          }} />
                        Ghép thông báo hạ
                      </label>
                    )}

                  </div>
                  <div className="composer-selected-actions">
                    <button className="composer-move-btn" disabled={idx === 0}
                      onClick={() => handleMoveItem(idx, -1)} title="Lên"><ArrowUp size={16} /></button>
                    <button className="composer-move-btn" disabled={idx === selectedItems.length - 1}
                      onClick={() => handleMoveItem(idx, 1)} title="Xuống"><ArrowDown size={16} /></button>
                    <button className="composer-remove-btn" onClick={() => handleRemoveItem(item.id)} title="Xoá"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* ═══ Win Rate Images ═══ */}
      <div className="composer-card">
        <h3 className="composer-section-title">Ảnh tỷ lệ thắng (không bắt buộc)</h3>
        <div className="composer-wr-upload">
          <label className="crop-upload-btn">
            <ImagePlus size={18} /><span>Thêm ảnh tỷ lệ thắng</span>
            <input type="file" accept="image/*" multiple onChange={handleUploadWr} hidden />
          </label>
          {uploadingWr && <Loader2 className="spin" size={18} />}
        </div>
        {winRateItems.length > 0 && (
          <div className="composer-wr-list">
            {winRateItems.map((item, idx) => (
              <div key={item.temp_id} className="composer-wr-item">
                <div className="composer-selected-order">{idx + 1}</div>
                <div className="composer-wr-img"><img src={item.image_url} alt={item.file_name} /></div>
                <div className="composer-wr-info">
                  <div className="composer-selected-name">{item.file_name}</div>
                  <div className="composer-selected-code">{item.object_name}</div>
                </div>
                <div className="composer-selected-actions">
                  <button className="composer-move-btn" disabled={idx === 0}
                    onClick={() => handleMoveWr(idx, -1)} title="Lên"><ArrowUp size={16} /></button>
                  <button className="composer-move-btn" disabled={idx === winRateItems.length - 1}
                    onClick={() => handleMoveWr(idx, 1)} title="Xuống"><ArrowDown size={16} /></button>
                  <button className="composer-remove-btn" onClick={() => handleRemoveWr(item.temp_id)} title="Xoá"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Section: Compose & Result ═══ */}
      <div className="composer-card">
        <h3 className="composer-section-title">Ghép và kết quả</h3>
        <button className="primary-button"
          disabled={loading || !bgObjectName || selectedItems.length === 0}
          onClick={handleCreateLayout}>
          <ImagePlus size={18} />
          Tạo layout chỉnh sửa
        </button>
        {message && <div className={`message ${message.includes('thành công') && !message.includes('Đang') ? '' : 'error'}`}>{message}</div>}
        {resultUrl && (
          <section className="result">
            <h3>Kết quả</h3>
            <img src={resultUrl} alt="Kết quả" />
            <a href={resultUrl} target="_blank" rel="noreferrer">Mở ảnh kết quả</a>
          </section>
        )}
      </div>
    </div>
  )
}
