/**
 * Config panel for the kill-notification crop tool.
 *
 * Separate from the shared CropConfigPanel because the two tools' auto modes
 * are nothing alike: the skin-card detector needs card size / start X / gap
 * from the user, while the banner detector derives all of its geometry from
 * the screenshot itself and only needs to know how many cards a row holds.
 */
export default function NotificationCropConfigPanel({
  mode,
  onModeChange,
  autoConfig,
  onAutoChange,
  manualConfig,
  onManualChange,
  imageSize,
}) {
  function handleManual(field, value) {
    onManualChange({ ...manualConfig, [field]: value })
  }

  return (
    <div className="crop-config-panel">
      <div className="crop-config-header">
        <h4>Chế độ cắt</h4>
      </div>

      {imageSize?.w > 0 && (
        <div className="crop-img-info">
          Kích thước ảnh: {imageSize.w} × {imageSize.h}
        </div>
      )}

      <div className="crop-mode-tabs">
        <button
          className={`crop-mode-tab ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => onModeChange('auto')}
        >
          Tự động nhận diện
        </button>
        <button
          className={`crop-mode-tab ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => onModeChange('manual')}
        >
          Cắt theo lưới thủ công
        </button>
      </div>

      {mode === 'auto' ? (
        <div className="crop-config-info">
          <p>
            Hệ thống tự tìm hàng thẻ tướng trong ảnh rồi lấy banner theo đúng vị trí cố định bên trong
            thẻ — <strong>không cần nhập toạ độ</strong>. Ảnh bị cuộn (hàng thẻ trên bị cắt cụt) vẫn
            nhận đúng.
          </p>
          <div className="crop-manual-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <span>Số banner/hàng</span>
              <input
                type="number"
                min="1"
                max="8"
                value={autoConfig.count_per_row}
                onChange={(e) => onAutoChange({ ...autoConfig, count_per_row: Number(e.target.value) })}
              />
            </div>
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
            Ô nào không có thẻ sẽ tự động bỏ qua, nên để 4 là được kể cả khi hàng chỉ có 2-3 thẻ.
          </p>
        </div>
      ) : (
        <div className="crop-manual-fields">
          <div className="crop-manual-grid">
            <div className="field">
              <span>Start X</span>
              <input type="number" min="0" value={manualConfig.start_x}
                onChange={(e) => handleManual('start_x', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Start Y</span>
              <input type="number" min="0" value={manualConfig.start_y}
                onChange={(e) => handleManual('start_y', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Chiều rộng</span>
              <input type="number" min="1" value={manualConfig.card_width}
                onChange={(e) => handleManual('card_width', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Chiều cao</span>
              <input type="number" min="1" value={manualConfig.card_height}
                onChange={(e) => handleManual('card_height', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Khoảng cách</span>
              <input type="number" min="0" value={manualConfig.gap_x}
                onChange={(e) => handleManual('gap_x', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Số hàng</span>
              <input type="number" min="1" max="10" value={manualConfig.row_count}
                onChange={(e) => handleManual('row_count', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Banner/hàng</span>
              <input type="number" min="1" max="20" value={manualConfig.count_per_row}
                onChange={(e) => handleManual('count_per_row', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Phạm vi tự căn (px)</span>
              <input type="number" min="0" max="400" value={manualConfig.refine_window ?? 120}
                onChange={(e) => handleManual('refine_window', Number(e.target.value))} />
            </div>
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
            Sau khi cắt theo lưới, hệ thống dò viền banner quanh vị trí đã nhập để căn lại cho khớp.
          </p>
        </div>
      )}
    </div>
  )
}
