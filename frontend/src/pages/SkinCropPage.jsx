import { useEffect, useMemo, useState } from 'react'
import { Crop, ImagePlus, Loader2, Scissors, ScanSearch, X } from 'lucide-react'

import { autoDetectCrop, manualCrop, deleteCroppedSkin } from '../services/skinCropService.js'
import CropConfigPanel, { DEFAULT_AUTO, DEFAULT_MANUAL } from '../components/skin-crop/CropConfigPanel.jsx'
import CroppedSkinGrid from '../components/skin-crop/CroppedSkinGrid.jsx'
import CreateSkinFromCropModal from '../components/skin-crop/CreateSkinFromCropModal.jsx'

export default function SkinCropPage() {
  const [imageFiles, setImageFiles] = useState([])
  const [mode, setMode] = useState('auto')
  const [manualConfig, setManualConfig] = useState({ ...DEFAULT_MANUAL })
  const [autoConfig, setAutoConfig] = useState({ ...DEFAULT_AUTO })

  const [croppedItems, setCroppedItems] = useState([])
  const [selectedCropped, setSelectedCropped] = useState(null)

  const [cropping, setCropping] = useState(false)
  const [cropProgress, setCropProgress] = useState(null)
  const [message, setMessage] = useState('')
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [detectInfo, setDetectInfo] = useState(null)
  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    function onResize() { setResizeTick(t => t + 1) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Create skin modal
  const [showCreateModal, setShowCreateModal] = useState(false)

  const originalPreview = useMemo(() => {
    if (imageFiles[0]) {
      return URL.createObjectURL(imageFiles[0])
    }
    return ''
  }, [imageFiles])

  function handleImageLoaded(e) {
    const img = e.target
    if (img) {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }

  function handleFilesChange(e) {
    const files = Array.from(e.target.files || [])
    setImageFiles(files)
    setCroppedItems([])
    setSelectedCropped(null)
    setMessage('')
    setImgNatural({ w: 0, h: 0 })
    setDetectInfo(null)
  }

  function handleRemoveQueuedFile(index) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleAutoDetect() {
    if (imageFiles.length === 0) {
      setMessage('Vui lòng chọn ảnh trước khi quét')
      return
    }

    try {
      setCropping(true)
      const allItems = []
      let totalDetected = 0
      let lastSize = null

      for (let i = 0; i < imageFiles.length; i++) {
        setCropProgress({ current: i + 1, total: imageFiles.length })
        setMessage(`Đang quét và cắt skin... (${i + 1}/${imageFiles.length})`)

        const formData = new FormData()
        formData.append('image', imageFiles[i])
        formData.append('card_width', String(autoConfig.card_width))
        formData.append('card_height', String(autoConfig.card_height))
        formData.append('gap_x', String(autoConfig.gap_x))
        formData.append('row_count', String(autoConfig.row_count))
        formData.append('count_per_row', String(autoConfig.count_per_row))
        formData.append('start_x', String(autoConfig.start_x))

        const result = await autoDetectCrop(formData)
        const offset = allItems.length
        allItems.push(...result.items.map((it) => ({ ...it, index: offset + it.index })))
        totalDetected += result.detected_count
        lastSize = { w: result.image_width, h: result.image_height }
      }

      setCroppedItems(allItems)
      setSelectedCropped(null)
      setDetectInfo(lastSize ? { w: lastSize.w, h: lastSize.h, count: totalDetected } : null)

      if (allItems.length === 0) {
        setMessage('Không tự nhận diện được card skin nào. Vui lòng chuyển sang chế độ "Cắt thủ công".')
      } else {
        setMessage(`Phát hiện ${totalDetected} card, cắt thành công ${allItems.length} ảnh skin từ ${imageFiles.length} ảnh nguồn`)
      }
    } catch (err) {
      setMessage(err.message || err.detail || 'Có lỗi xảy ra khi quét ảnh')
    } finally {
      setCropping(false)
      setCropProgress(null)
    }
  }

  async function handleManualCrop() {
    if (imageFiles.length === 0) {
      setMessage('Vui lòng chọn ảnh trước khi cắt')
      return
    }

    try {
      setCropping(true)
      const allItems = []

      for (let i = 0; i < imageFiles.length; i++) {
        setCropProgress({ current: i + 1, total: imageFiles.length })
        setMessage(`Đang cắt thủ công... (${i + 1}/${imageFiles.length})`)

        const formData = new FormData()
        formData.append('image', imageFiles[i])
        formData.append('start_x', String(manualConfig.start_x))
        formData.append('start_y', String(manualConfig.start_y))
        formData.append('card_width', String(manualConfig.card_width))
        formData.append('card_height', String(manualConfig.card_height))
        formData.append('gap_x', String(manualConfig.gap_x))
        formData.append('row_count', String(manualConfig.row_count))
        formData.append('count_per_row', String(manualConfig.count_per_row))

        const result = await manualCrop(formData)
        const offset = allItems.length
        allItems.push(...result.items.map((it) => ({ ...it, index: offset + it.index })))
      }

      setCroppedItems(allItems)
      setSelectedCropped(null)
      setMessage(`Cắt thành công ${allItems.length} ảnh skin từ ${imageFiles.length} ảnh nguồn`)
    } catch (err) {
      setMessage(err.message || err.detail || 'Có lỗi xảy ra khi cắt ảnh')
    } finally {
      setCropping(false)
      setCropProgress(null)
    }
  }

  async function handleDeleteCropped(item) {
    try {
      await deleteCroppedSkin(item.object_name)
      setCroppedItems((prev) => prev.filter((i) => i.index !== item.index))
      if (selectedCropped?.index === item.index) {
        setSelectedCropped(null)
      }
      setMessage(`Đã xóa ảnh cắt ${item.index}`)
    } catch (err) {
      setMessage(err.message || 'Không thể xóa ảnh đã cắt')
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
    setMessage('Thêm skin thành công')
    // Keep the cropped items visible
  }

  const cropButtonLabel = imageFiles.length > 1 ? ` (${imageFiles.length} ảnh)` : ''

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Danh mục cắt skin</h2>
          <p>
            Upload ảnh chụp màn hình cửa hàng skin trong game, cắt nhanh thành từng ảnh skin riêng lẻ. Có thể chọn nhiều ảnh cùng lúc để cắt hàng loạt.
          </p>
        </div>
      </div>

      {/* Upload & Crop controls */}
      <div className="crop-controls">
        <div className="crop-upload-area">
          <label className="crop-upload-btn">
            <ImagePlus size={18} />
            <span>Chọn ảnh (có thể chọn nhiều)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFilesChange} hidden />
          </label>
          {imageFiles.length > 0 && mode === 'auto' && (
            <button className="crop-crop-btn" onClick={handleAutoDetect} disabled={cropping}>
              {cropping ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <ScanSearch size={18} />
              )}
              {cropping ? `Đang quét... (${cropProgress?.current ?? 0}/${cropProgress?.total ?? imageFiles.length})` : `Quét và cắt skin${cropButtonLabel}`}
            </button>
          )}
          {imageFiles.length > 0 && mode === 'manual' && (
            <button className="crop-crop-btn" onClick={handleManualCrop} disabled={cropping}>
              {cropping ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Scissors size={18} />
              )}
              {cropping ? `Đang cắt... (${cropProgress?.current ?? 0}/${cropProgress?.total ?? imageFiles.length})` : `Cắt thủ công${cropButtonLabel}`}
            </button>
          )}
        </div>

        {imageFiles.length > 1 && (
          <div className="crop-queue-list">
            {imageFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="crop-queue-item">
                <span className="crop-queue-item-name" title={file.name}>{i === 0 ? '★ ' : ''}{file.name}</span>
                <button className="crop-queue-item-remove" onClick={() => handleRemoveQueuedFile(i)} title="Bỏ ảnh này khỏi danh sách" disabled={cropping}>
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

        {detectInfo && (
          <div className="crop-img-info">
            Ảnh: {detectInfo.w}×{detectInfo.h} — Phát hiện {detectInfo.count} card
          </div>
        )}
        {message && (
          <div className={`crop-message ${!message.includes('Không') && message.includes('thành công') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Main layout: 2 columns */}
      <div className="crop-main-layout">
        {/* Left: Original image + config */}
        <div className="crop-left">
          {/* Original image preview */}
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
                  id="crop-source-img"
                />
                {mode === 'manual' && imgNatural.w > 0 && (
                  <canvas
                    key={JSON.stringify(manualConfig) + imgNatural.w + imgNatural.h + resizeTick}
                    id="crop-grid-overlay"
                    className="crop-overlay-canvas"
                    ref={canvasRef => {
                      if (!canvasRef || !imgNatural.w) return
                      const img = document.getElementById('crop-source-img')
                      if (!img) { setTimeout(() => canvasRef.getContext('2d'), 50); return }
                      const rect = img.getBoundingClientRect()
                      canvasRef.width = rect.width
                      canvasRef.height = rect.height
                      const ctx = canvasRef.getContext('2d')
                      const sx = rect.width / imgNatural.w
                      const sy = rect.height / imgNatural.h
                      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height)
                      ctx.strokeStyle = 'rgba(37, 99, 235, 0.8)'
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
                          if (col === 0) {
                            ctx.fillStyle = '#fff'
                            ctx.font = 'bold 14px sans-serif'
                            ctx.fillText(`R${row + 1}`, x + 4, y + 16)
                            ctx.fillStyle = 'rgba(37, 99, 235, 0.12)'
                          }
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

          {/* Crop config with tabs */}
          <CropConfigPanel
            mode={mode}
            onModeChange={setMode}
            manualConfig={manualConfig}
            onManualChange={setManualConfig}
            autoConfig={autoConfig}
            onAutoChange={setAutoConfig}
            imageSize={imgNatural}
          />
        </div>

        {/* Right: Cropped results */}
        <div className="crop-right">
          <div className="crop-right-header">
            <h4>Ảnh đã cắt</h4>
            {selectedCropped && (
              <button className="secondary-button" onClick={handleOpenCreateModal}>
                <Crop size={16} /> Thêm skin vào tướng
              </button>
            )}
          </div>

          <CroppedSkinGrid
            items={croppedItems}
            selectedIndex={selectedCropped?.index}
            onSelect={handleSelectCropped}
            onDelete={handleDeleteCropped}
          />
        </div>
      </div>

      {/* Create Skin Modal */}
      <CreateSkinFromCropModal
        open={showCreateModal}
        croppedItem={selectedCropped}
        onClose={() => setShowCreateModal(false)}
        onSaved={handleCreateSaved}
      />
    </div>
  )
}
