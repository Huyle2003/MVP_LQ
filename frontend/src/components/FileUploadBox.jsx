export default function FileUploadBox({ label, file, previewUrl, onChange }) {
  return (
    <div className="upload-box">
      <label className="upload-label">{label}</label>

      <input
        className="file-input"
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />

      {previewUrl ? (
        <img className="preview-image" src={previewUrl} alt={label} />
      ) : (
        <div className="empty-preview">Chưa chọn ảnh</div>
      )}

      {file && <div className="file-name">{file.name}</div>}
    </div>
  )
}
