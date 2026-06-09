const DEFAULT_MANUAL = {
  start_x: 480,
  start_y: 175,
  card_width: 230,
  card_height: 415,
  gap_x: 12,
  row_count: 1,
  count_per_row: 5,
}

export default function CropConfigPanel({ mode, onModeChange, manualConfig, onManualChange, imageSize }) {
  function handleManualField(field, value) {
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

      {/* Tab buttons */}
      <div className="crop-mode-tabs">
        <button
          className={`crop-mode-tab ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => onModeChange('auto')}
        >
          Tự động quét card
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
            Hệ thống dùng OpenCV để tự động phát hiện các card skin trong ảnh
            dựa trên viền, kích thước và tỷ lệ. Không phụ thuộc template hay
            tọa độ cố định.
          </p>
          <p>
            Nếu không tìm đủ card, hãy chuyển sang chế độ <strong>Cắt thủ công</strong>.
          </p>
        </div>
      ) : (
        <div className="crop-manual-fields">
          <div className="crop-manual-grid">
            <div className="field">
              <span>Start X</span>
              <input type="number" min="0" value={manualConfig.start_x}
                onChange={(e) => handleManualField('start_x', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Start Y</span>
              <input type="number" min="0" value={manualConfig.start_y}
                onChange={(e) => handleManualField('start_y', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Card width</span>
              <input type="number" min="1" value={manualConfig.card_width}
                onChange={(e) => handleManualField('card_width', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Card height</span>
              <input type="number" min="1" value={manualConfig.card_height}
                onChange={(e) => handleManualField('card_height', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Gap X</span>
              <input type="number" min="0" value={manualConfig.gap_x}
                onChange={(e) => handleManualField('gap_x', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Số hàng</span>
              <input type="number" min="1" max="10" value={manualConfig.row_count}
                onChange={(e) => handleManualField('row_count', Number(e.target.value))} />
            </div>
            <div className="field">
              <span>Card/hàng</span>
              <input type="number" min="1" max="20" value={manualConfig.count_per_row}
                onChange={(e) => handleManualField('count_per_row', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
