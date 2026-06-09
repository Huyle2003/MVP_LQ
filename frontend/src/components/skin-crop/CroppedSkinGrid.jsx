import { Trash2, CheckCircle } from 'lucide-react'

export default function CroppedSkinGrid({ items, selectedIndex, onSelect, onDelete }) {
  if (!items || items.length === 0) {
    return (
      <div className="empty-state small">
        <p>Chưa có ảnh nào được cắt. Hãy upload và bấm "Quét và cắt skin".</p>
      </div>
    )
  }

  return (
    <div className="cropped-grid">
      {items.map((item) => {
        const isSelected = selectedIndex === item.index
        return (
          <div
            key={item.index}
            className={`cropped-card ${isSelected ? 'selected' : ''}`}
          >
            <div className="cropped-card-image">
              <img src={item.image_url} alt={`Ảnh cắt ${item.index}`} />
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
  )
}
