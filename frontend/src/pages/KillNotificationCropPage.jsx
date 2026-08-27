import { useEffect, useMemo, useState } from 'react'
import { Crop, ImagePlus, Loader2, ScanSearch, Scissors, X } from 'lucide-react'

import { autoDetectNotificationCrop, manualCrop, removeBackground, deleteCroppedSkin } from '../services/skinCropService.js'
import { DEFAULT_MANUAL } from '../components/skin-crop/CropConfigPanel.jsx'
import NotificationCropConfigPanel from '../components/skin-crop/NotificationCropConfigPanel.jsx'
import CroppedSkinGrid from '../components/skin-crop/CroppedSkinGrid.jsx'
import CreateKillNotificationFromCropModal from '../components/skin-crop/CreateKillNotificationFromCropModal.jsx'

// Auto background removal is temporarily disabled (per user request) — flip
// this back to true to re-enable the xoá nền step without touching anything
// else, backend included.
const BG_REMOVAL_ENABLED = false

// Notification banners have their own tuned grid dimensions — distinct from
// the skin crop tool's defaults (which CropConfigPanel's DEFAULT_AUTO/
// DEFAULT_MANUAL are shared with), so override just the fields here rather
// than touching those shared defaults.
// Auto mode derives all geometry from the screenshot, so it only needs the
// column count. Manual mode keeps the measured grid values as a fallback.
const NOTIF_DEFAULT_AUTO = { count_per_row: 4 }
const NOTIF_DEFAULT_MANUAL = { ...DEFAULT_MANUAL, start_x: 765, start_y: 686, gap_x: 55, card_width: 378, card_height: 118, count_per_row: 4, refine_window: 120 }

export default function KillNotificationCropPage() {
  const [imageFiles, setImageFiles] = useState([])
  // Auto is the default: the banner detector locks onto the card grid's
  // fixed geometry and was verified to find all 68 banners across 17 real
  // screenshots, including scrolled ones. Manual stays as an escape hatch.
  const [mode, setMode] = useState('auto')
  const [manualConfig, setManualConfig] = useState({ ...NOTIF_DEFAULT_MANUAL })
  const [autoConfig, setAutoConfig] = useState({ ...NOTIF_DEFAULT_AUTO })

  const [croppedItems, setCroppedItems] = useState([])
  const [selectedCropped, setSelectedCropped] = useState(null)

  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [message, setMessage] = useState('')
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [resizeTick, setResizeTick] = useState(0)

  const [showCreateModal, setShowCreateModal] = useState(false)

  const scanButtonLabel = BG_REMOVAL_ENABLED ? 'Quét & xoá nền' : 'Quét banner'
  const cropButtonLabel = BG_REMOVAL_ENABLED ? 'Cắt & xoá nền' : 'Cắt banner'
  const resultHeaderLabel = BG_REMOVAL_ENABLED ? 'Banner đã cắt (đã xoá nền)' : 'Banner đã cắt'

  useEffect(() => {
    function onResize() { setResizeTick((t) => t + 1) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const originalPreview = useMemo(() => {
    if (imageFiles[0]) return URL.createObjectURL(imageFiles[0])
    return ''
  }, [imageFiles])

  function handleImageLoaded(e) {
    const img = e.target
    if (img) setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
  }

  function handleFilesChange(e) {
    const files = Array.from(e.target.files || [])
    setImageFiles(files)
    setCroppedItems([])
    setSelectedCropped(null)
    setMessage('')
    setImgNatural({ w: 0, h: 0 })
  }

  function handleRemoveQueuedFile(index) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function removeBgFromAll(items) {
    if (!BG_REMOVAL_ENABLED) {
      return items.map((it, i) => ({ index: i + 1, object_name: it.object_name, image_url: it.image_url }))
    }
    const processed = []
    for (let i = 0; i < items.length; i++) {
      setProgress({ current: i + 1, total: items.length })
      setMessage(`Đang xoá nền... (${i + 1}/${items.length})`)
      const nobg = await removeBackground(items[i].object_name)
      processed.push({ index: i + 1, object_name: nobg.object_name, image_url: nobg.image_url })
      // The raw crop (before bg removal) isn't needed once we have the transparent version.
      deleteCroppedSkin(items[i].object_name).catch(() => {})
    }
    return processed
  }

  async function handleAutoDetect() {
    if (imageFiles.length === 0) {
      setMessage('Vui lòng chọn ảnh trước khi quét')
      return
    }
    try {
      setProcessing(true)
      setCroppedItems([])
      setSelectedCropped(null)
      const allRaw = []

      for (let i = 0; i < imageFiles.length; i++) {
        setProgress({ current: i + 1, total: imageFiles.length })
        setMessage(`Đang quét vị trí banner... (${i + 1}/${imageFiles.length})`)

        const formData = new FormData()
        formData.append('image', imageFiles[i])
        formData.append('count_per_row', String(autoConfig.count_per_row))

        const result = await autoDetectNotificationCrop(formData)
        allRaw.push(...(result.items || []))
      }

      if (allRaw.length === 0) {
        setMessage('Không tự nhận diện được banner nào. Vui lòng chuyển sang chế độ "Cắt theo lưới thủ công".')
        return
      }

      const processed = await removeBgFromAll(allRaw)
      setCroppedItems(processed)
      setMessage(BG_REMOVAL_ENABLED
        ? `Phát hiện và xoá nền thành công ${processed.length} banner từ ${imageFiles.length} ảnh nguồn.`
        : `Phát hiện thành công ${processed.length} banner từ ${imageFiles.length} ảnh nguồn.`)
    } catch (err) {
      setMessage(err.message || 'Có lỗi xảy ra khi quét ảnh')
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  async function handleManualCrop() {
    if (imageFiles.length === 0) {
      setMessage('Vui lòng chọn ảnh trước khi cắt')
      return
    }
    try {
      setProcessing(true)
      setCroppedItems([])
      setSelectedCropped(null)
      const allRaw = []

      for (let i = 0; i < imageFiles.length; i++) {
        setProgress({ current: i + 1, total: imageFiles.length })
        setMessage(`Đang cắt ảnh... (${i + 1}/${imageFiles.length})`)

        const formData = new FormData()
        formData.append('image', imageFiles[i])
        formData.append('start_x', String(manualConfig.start_x))
        formData.append('start_y', String(manualConfig.start_y))
        formData.append('card_width', String(manualConfig.card_width))
        formData.append('card_height', String(manualConfig.card_height))
        formData.append('gap_x', String(manualConfig.gap_x))
        formData.append('row_count', String(manualConfig.row_count))
        formData.append('count_per_row', String(manualConfig.count_per_row))
        // Real banner spacing is rarely perfectly uniform — a fixed stride
        // compounds that small error more with every column. This nudges
        // each column within a small window of its expected position to
        // the strongest nearby left-edge match instead of trusting the
        // math blindly.
        formData.append('refine_x', 'true')
        formData.append('refine_y', 'true')
        formData.append('refine_window', String(manualConfig.refine_window ?? 120))

        const result = await manualCrop(formData)
        allRaw.push(...(result.items || []))
      }

      if (allRaw.length === 0) {
        setMessage('Không cắt được ảnh nào — kiểm tra lại toạ độ/kích thước lưới cắt.')
        return
      }

      const processed = await removeBgFromAll(allRaw)
      setCroppedItems(processed)
      setMessage(BG_REMOVAL_ENABLED
        ? `Cắt và xoá nền thành công ${processed.length} banner từ ${imageFiles.length} ảnh nguồn.`
        : `Cắt thành công ${processed.length} banner từ ${imageFiles.length} ảnh nguồn.`)
    } catch (err) {
      setMessage(err.message || 'Có lỗi xảy ra khi cắt ảnh')
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  async function handleDeleteCropped(item) {
    try {
      await deleteCroppedSkin(item.object_name)
      setCroppedItems((prev) => prev.filter((i) => i.index !== item.index))
      if (selectedCropped?.index === item.index) setSelectedCropped(null)
      setMessage(`Đã xoá banner ${item.index}`)
    } catch (err) {
      setMessage(err.message || 'Không thể xoá ảnh đã cắt')
    }
  }

  function handleSelectCropped(item) {
    setSelectedCropped(item)
  }

  function handleOpenCreateModal() {
    if (!selectedCropped) return
    setShowCreateModal(true)
  }

  function handleCreateSaved() {
    setShowCreateModal(false)
    setMessage('Thêm thông báo hạ thành công')
  }

  const fileCountSuffix = imageFiles.length > 1 ? ` (${imageFiles.length} ảnh)` : ''

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Cắt thông báo hạ</h2>
          <p>
            Upload ảnh chụp nhiều banner thông báo hạ xếp thành hàng — giống hệt công cụ cắt skin
            (tự động dò vị trí hoặc cắt theo lưới thủ công, chọn nhiều ảnh cùng lúc để cắt hàng loạt).
            {BG_REMOVAL_ENABLED && ' Mỗi banner cắt ra sẽ tự động được xoá nền trong suốt.'}
          </p>
        </div>
      </div>

      <div className="crop-controls">
        <div className="crop-upload-area">
          <label className="crop-upload-btn">
            <ImagePlus size={18} />
            <span>Chọn ảnh (có thể chọn nhiều)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFilesChange} hidden />
          </label>
          {imageFiles.length > 0 && mode === 'auto' && (
            <button className="crop-crop-btn" onClick={handleAutoDetect} disabled={processing}>
              {processing ? <Loader2 className="spin" size={18} /> : <ScanSearch size={18} />}
              {processing ? `Đang xử lý... (${progress?.current ?? 0}/${progress?.total ?? ''})` : `${scanButtonLabel}${fileCountSuffix}`}
            </button>
          )}
          {imageFiles.length > 0 && mode === 'manual' && (
            <button className="crop-crop-btn" onClick={handleManualCrop} disabled={processing}>
              {processing ? <Loader2 className="spin" size={18} /> : <Scissors size={18} />}
              {processing ? `Đang xử lý... (${progress?.current ?? 0}/${progress?.total ?? ''})` : `${cropButtonLabel}${fileCountSuffix}`}
            </button>
          )}
        </div>

        {imageFiles.length > 1 && (
          <div className="crop-queue-list">
            {imageFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="crop-queue-item">
                <span className="crop-queue-item-name" title={file.name}>{i === 0 ? '★ ' : ''}{file.name}</span>
                <button className="crop-queue-item-remove" onClick={() => handleRemoveQueuedFile(i)} title="Bỏ ảnh này khỏi danh sách" disabled={processing}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {imageFiles.length > 1 && (
          <div className="crop-img-info">
            Ảnh đầu tiên (★) dùng để xem trước lưới cắt ở chế độ thủ công. Cấu hình bên dưới sẽ áp dụng cho tất cả {imageFiles.length} ảnh.
          </div>
        )}

        {message && (
          <div className={`crop-message ${message.includes('thành công') ? 'success' : message.includes('lỗi') || message.includes('Không') ? 'error' : ''}`}>
            {message}
          </div>
        )}
      </div>

      <div className="crop-main-layout">
        {/* Left: source image + crop config */}
        <div className="crop-left">
          <div className="crop-preview-box">
            <div className="crop-preview-header">
              <h4>Ảnh gốc{imageFiles.length > 1 ? ' (ảnh đầu tiên)' : ''}</h4>
              {imgNatural.w > 0 && (
                <span className="crop-img-size">{imgNatural.w} × {imgNatural.h}</span>
              )}
            </div>
            {originalPreview ? (
              <div className="crop-preview-container">
                <img
                  className="crop-preview-img"
                  src={originalPreview}
                  alt="Original"
                  onLoad={handleImageLoaded}
                  id="notif-crop-source-img"
                />
                {mode === 'manual' && imgNatural.w > 0 && (
                  <canvas
                    key={JSON.stringify(manualConfig) + imgNatural.w + imgNatural.h + resizeTick}
                    className="crop-overlay-canvas"
                    ref={(canvasRef) => {
                      if (!canvasRef || !imgNatural.w) return
                      const img = document.getElementById('notif-crop-source-img')
                      if (!img) return
                      const rect = img.getBoundingClientRect()
                      canvasRef.width = rect.width
                      canvasRef.height = rect.height
                      const ctx = canvasRef.getContext('2d')
                      const sx = rect.width / imgNatural.w
                      const sy = rect.height / imgNatural.h
                      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)
                      ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)'
                      ctx.lineWidth = 2
                      ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
                      const cfg = manualConfig
                      for (let row = 0; row < cfg.row_count; row++) {
                        for (let col = 0; col < cfg.count_per_row; col++) {
                          const x = (cfg.start_x + col * (cfg.card_width + cfg.gap_x)) * sx
                          const y = (cfg.start_y + row * (cfg.card_height + cfg.gap_x)) * sy
                          const w = cfg.card_width * sx
                          const h = cfg.card_height * sy
                          ctx.fillRect(x, y, w, h)
                          ctx.strokeRect(x, y, w, h)
                        }
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="empty-preview">Chưa chọn ảnh</div>
            )}
          </div>

          <NotificationCropConfigPanel
            mode={mode}
            onModeChange={setMode}
            autoConfig={autoConfig}
            onAutoChange={setAutoConfig}
            manualConfig={manualConfig}
            onManualChange={setManualConfig}
            imageSize={imgNatural}
          />
        </div>

        {/* Right: cropped results */}
        <div className="crop-right">
          <div className="crop-right-header">
            <h4>{resultHeaderLabel}</h4>
            {selectedCropped && (
              <button className="secondary-button" onClick={handleOpenCreateModal}>
                <Crop size={16} /> Thêm vào skin
              </button>
            )}
          </div>

          <CroppedSkinGrid
            items={croppedItems}
            selectedIndex={selectedCropped?.index}
            onSelect={handleSelectCropped}
            onDelete={handleDeleteCropped}
            emptyMessage={`Chưa có banner nào được cắt. Hãy upload ảnh và bấm "${scanButtonLabel}" hoặc "${cropButtonLabel}".`}
          />
        </div>
      </div>

      <CreateKillNotificationFromCropModal
        open={showCreateModal}
        croppedItem={selectedCropped}
        onClose={() => setShowCreateModal(false)}
        onSaved={handleCreateSaved}
      />
    </div>
  )
}
