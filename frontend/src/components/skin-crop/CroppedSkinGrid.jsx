import { Trash2, CheckCircle, Maximize2 } from 'lucide-react'
import { useState } from 'react'

export default function CroppedSkinGrid({
  items,
  selectedIndex,
  onSelect,
  onDelete,
  emptyMessage = 'Chưa có ảnh nào được cắt. Hãy upload và bấm "Quét và cắt skin".',
}) {
  const [previewUrl, setPreviewUrl] = useState(null)
  if (!items || items.length === 0) {
    return (
      <div className="empty-state small">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      {previewUrl && (
        <div className="modal-overlay" onClick={() => setPreviewUrl(null)} style={{ cursor: 'pointer' }}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt="Preview" style={{ width: '100%', height: 'auto', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
      )}
      <div className="cropped-grid">
        {items.map((item) => {
          const isSelected = selectedIndex === item.index
          return (
            <div
              key={item.index}
              className={`cropped-card ${isSelected ? 'selected' : ''}`}
            >
              <div className="cropped-card-image" style={{ cursor: 'pointer' }} onClick={() => setPreviewUrl(item.image_url)}>
                <img src={item.image_url} alt={`Ảnh cắt ${item.index}`} />
                <div style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', pointerEvents: 'none' }}>
                  <Maximize2 size={14} />
                </div>
              </div>
              <div className="cropped-card-label">Ảnh cắt {item.index}</div>
              {item.box && (
                <div className="cropped-card-box">
                  {item.box.x},{item.box.y} ({item.box.width}×{item.box.height})
                </div>
              )}
              <div className="cropped-card-actions">
                <button
                  className={`table-action ${isSelected ? 'active-action' : ''}`}
                  onClick={() => onSelect(item)}
                  title="Chọn ảnh này"
                >
                  <CheckCircle size={16} />
                  {isSelected ? ' Đã chọn' : ' Chọn'}
                </button>
                <button
                  className="table-action danger-action"
                  onClick={() => onDelete(item)}
                  title="Xoá"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
