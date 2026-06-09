import { useMemo, useState } from 'react'
import { Crop, ImagePlus, Loader2, Scissors, ScanSearch } from 'lucide-react'

import { autoDetectCrop, manualCrop, deleteCroppedSkin } from '../services/skinCropService.js'
import CropConfigPanel from '../components/skin-crop/CropConfigPanel.jsx'
import CroppedSkinGrid from '../components/skin-crop/CroppedSkinGrid.jsx'
import CreateSkinFromCropModal from '../components/skin-crop/CreateSkinFromCropModal.jsx'

const DEFAULT_MANUAL = {
  start_x: 480,
  start_y: 175,
  card_width: 230,
  card_height: 415,
  gap_x: 12,
  row_count: 1,
  count_per_row: 5,
}

export default function SkinCropPage() {
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [mode, setMode] = useState('auto')
  const [manualConfig, setManualConfig] = useState({ ...DEFAULT_MANUAL })

  const [croppedItems, setCroppedItems] = useState([])
  const [selectedCropped, setSelectedCropped] = useState(null)

  const [cropping, setCropping] = useState(false)
  const [message, setMessage] = useState('')
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [detectInfo, setDetectInfo] = useState(null)

  // Create skin modal
  const [showCreateModal, setShowCreateModal] = useState(false)

  const originalPreview = useMemo(() => {
    if (imageFile) {
      return URL.createObjectURL(imageFile)
    }
    return ''
  }, [imageFile])

  function handleImageLoaded(e) {
    const img = e.target
    if (img) {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null
    setImageFile(file)
    if (file) {
      setImagePreview(URL.createObjectURL(file))
    } else {
      setImagePreview('')
    }
    setCroppedItems([])
    setSelectedCropped(null)
    setMessage('')
    setImgNatural({ w: 0, h: 0 })
    setDetectInfo(null)
  }

  async function handleAutoDetect() {
    if (!imageFile) {
      setMessage('Vui lòng chọn ảnh trước khi quét')
      return
    }

    try {
      setCropping(true)
      setMessage('Đang quét và cắt skin...')

      const formData = new FormData()
      formData.append('image', imageFile)

      const result = await autoDetectCrop(formData)
      setCroppedItems(result.items)
      setSelectedCropped(null)
      setDetectInfo({ w: result.image_width, h: result.image_height, count: result.detected_count })

      if (result.items.length === 0) {
        setMessage('Không tự nhận diện được card skin nào. Vui lòng chuyển sang chế độ "Cắt thủ công".')
      } else {
        setMessage(`Phát hiện ${result.detected_count} card, cắt thành công ${result.items.length} ảnh skin`)
      }
    } catch (err) {
      setMessage(err.message || err.detail || 'Có lỗi xảy ra khi quét ảnh')
    } finally {
      setCropping(false)
    }
  }

  async function handleManualCrop() {
    if (!imageFile) {
      setMessage('Vui lòng chọn ảnh trước khi cắt')
      return
    }

    try {
      setCropping(true)
      setMessage('Đang cắt thủ công...')

      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('start_x', String(manualConfig.start_x))
      formData.append('start_y', String(manualConfig.start_y))
      formData.append('card_width', String(manualConfig.card_width))
      formData.append('card_height', String(manualConfig.card_height))
      formData.append('gap_x', String(manualConfig.gap_x))
      formData.append('row_count', String(manualConfig.row_count))
      formData.append('count_per_row', String(manualConfig.count_per_row))

      const result = await manualCrop(formData)
      setCroppedItems(result.items)
      setSelectedCropped(null)
      setMessage(`Cắt thành công ${result.items.length} ảnh skin`)
    } catch (err) {
      setMessage(err.message || err.detail || 'Có lỗi xảy ra khi cắt ảnh')
    } finally {
      setCropping(false)
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

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Danh mục cắt skin</h2>
          <p>
            Upload ảnh chụp màn hình cửa hàng skin trong game, cắt nhanh thành từng ảnh skin riêng lẻ.
          </p>
        </div>
      </div>

      {/* Upload & Crop controls */}
      <div className="crop-controls">
        <div className="crop-upload-area">
          <label className="crop-upload-btn">
            <ImagePlus size={18} />
            <span>Chọn ảnh</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} hidden />
          </label>
          {imageFile && mode === 'auto' && (
            <button className="crop-crop-btn" onClick={handleAutoDetect} disabled={cropping}>
              {cropping ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <ScanSearch size={18} />
              )}
              {cropping ? 'Đang quét...' : 'Quét và cắt skin'}
            </button>
          )}
          {imageFile && mode === 'manual' && (
            <button className="crop-crop-btn" onClick={handleManualCrop} disabled={cropping}>
              {cropping ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Scissors size={18} />
              )}
              {cropping ? 'Đang cắt...' : 'Cắt thủ công'}
            </button>
          )}
        </div>
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
              <h4>Ảnh gốc</h4>
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
                />
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
