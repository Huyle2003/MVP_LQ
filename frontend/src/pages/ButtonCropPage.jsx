import { useMemo, useState } from 'react'
import { Crop, ImagePlus, Loader2, ScanSearch, X } from 'lucide-react'

import { autoDetectButtonCrop, deleteCroppedSkin } from '../services/skinCropService.js'
import CroppedSkinGrid from '../components/skin-crop/CroppedSkinGrid.jsx'
import CreateButtonFromCropModal from '../components/skin-crop/CreateButtonFromCropModal.jsx'

export default function ButtonCropPage() {
  const [imageFiles, setImageFiles] = useState([])
  const [countPerRow, setCountPerRow] = useState(4)

  const [croppedItems, setCroppedItems] = useState([])
  const [selectedCropped, setSelectedCropped] = useState(null)

  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [message, setMessage] = useState('')
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })

  const [showCreateModal, setShowCreateModal] = useState(false)

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

  async function handleDetect() {
    if (imageFiles.length === 0) {
      setMessage('Vui lòng chọn ảnh trước khi quét')
      return
    }
    try {
      setProcessing(true)
      setCroppedItems([])
      setSelectedCropped(null)
      const all = []

      for (let i = 0; i < imageFiles.length; i++) {
        setProgress({ current: i + 1, total: imageFiles.length })
        setMessage(`Đang quét nút... (${i + 1}/${imageFiles.length})`)

        const formData = new FormData()
        formData.append('image', imageFiles[i])
        formData.append('count_per_row', String(countPerRow))

        const result = await autoDetectButtonCrop(formData)
        all.push(...(result.items || []))
      }

      if (all.length === 0) {
        setMessage('Không nhận diện được nút nào. Kiểm tra lại ảnh có đúng là màn "Nút" trong game không.')
        return
      }

      setCroppedItems(all.map((it, i) => ({ ...it, index: i + 1 })))
      setMessage(`Cắt thành công ${all.length} nút từ ${imageFiles.length} ảnh nguồn.`)
    } catch (err) {
      setMessage(err.message || 'Có lỗi xảy ra khi quét ảnh')
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
      setMessage(`Đã xoá nút ${item.index}`)
    } catch (err) {
      setMessage(err.message || 'Không thể xoá ảnh đã cắt')
    }
  }

  function handleCreateSaved() {
    setShowCreateModal(false)
    setMessage('Thêm nút bấm thành công')
  }

  const fileCountSuffix = imageFiles.length > 1 ? ` (${imageFiles.length} ảnh)` : ''

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Cắt nút bấm</h2>
          <p>
            Upload ảnh chụp màn "Nút" trong game — hệ thống tự tìm hàng thẻ tướng rồi cắt icon nút ở
            đúng vị trí cố định bên trong thẻ. Không cần nhập toạ độ, chọn nhiều ảnh cùng lúc được.
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
          {imageFiles.length > 0 && (
            <button className="crop-crop-btn" onClick={handleDetect} disabled={processing}>
              {processing ? <Loader2 className="spin" size={18} /> : <ScanSearch size={18} />}
              {processing
                ? `Đang xử lý... (${progress?.current ?? 0}/${progress?.total ?? ''})`
                : `Quét & cắt nút${fileCountSuffix}`}
            </button>
          )}
        </div>

        {imageFiles.length > 1 && (
          <div className="crop-queue-list">
            {imageFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="crop-queue-item">
                <span className="crop-queue-item-name" title={file.name}>{i === 0 ? '★ ' : ''}{file.name}</span>
                <button className="crop-queue-item-remove" onClick={() => handleRemoveQueuedFile(i)} disabled={processing}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {message && (
          <div className={`crop-message ${message.includes('thành công') ? 'success' : message.includes('lỗi') || message.includes('Không') ? 'error' : ''}`}>
            {message}
          </div>
        )}
      </div>

      <div className="crop-main-layout">
        <div className="crop-left">
          <div className="crop-preview-box">
            <div className="crop-preview-header">
              <h4>Ảnh gốc{imageFiles.length > 1 ? ' (ảnh đầu tiên)' : ''}</h4>
              {imgNatural.w > 0 && <span className="crop-img-size">{imgNatural.w} × {imgNatural.h}</span>}
            </div>
            {originalPreview ? (
              <div className="crop-preview-container">
                <img className="crop-preview-img" src={originalPreview} alt="Original" onLoad={handleImageLoaded} />
              </div>
            ) : (
              <div className="empty-preview">Chưa chọn ảnh</div>
            )}
          </div>

          <div className="crop-config-panel">
            <div className="crop-config-header">
              <h4>Cấu hình</h4>
            </div>
            <div className="crop-config-info">
              <p>
                Chỉ cắt hàng thẻ trên cùng của mỗi ảnh. Ảnh bị cuộn (hàng thẻ trên bị cắt cụt) vẫn nhận đúng.
              </p>
            </div>
            <div className="crop-manual-grid" style={{ marginTop: 12 }}>
              <div className="field">
                <span>Số nút/hàng</span>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={countPerRow}
                  onChange={(e) => setCountPerRow(Number(e.target.value))}
                />
              </div>
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
              Ô nào không có thẻ sẽ tự bỏ qua, nên để 4 là được kể cả khi hàng chỉ có 2-3 thẻ.
            </p>
          </div>
        </div>

        <div className="crop-right">
          <div className="crop-right-header">
            <h4>Nút đã cắt</h4>
            {selectedCropped && (
              <button className="secondary-button" onClick={() => setShowCreateModal(true)}>
                <Crop size={16} /> Thêm vào skin
              </button>
            )}
          </div>

          <CroppedSkinGrid
            items={croppedItems}
            selectedIndex={selectedCropped?.index}
            onSelect={setSelectedCropped}
            onDelete={handleDeleteCropped}
            emptyMessage='Chưa có nút nào được cắt. Hãy upload ảnh và bấm "Quét & cắt nút".'
          />
        </div>
      </div>

      <CreateButtonFromCropModal
        open={showCreateModal}
        croppedItem={selectedCropped}
        onClose={() => setShowCreateModal(false)}
        onSaved={handleCreateSaved}
      />
    </div>
  )
}
