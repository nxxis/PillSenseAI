import React from 'react';

export default function AlertModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) {
  if (!open) return null;
  return (
    <div className="alert-modal-overlay">
      <div className="alert-modal-card">
        <h3>{title}</h3>
        <div className="alert-modal-message">{message}</div>
        <div className="alert-modal-actions">
          <button
            className="btn"
            onClick={onConfirm}
            style={{ marginRight: 8 }}
          >
            {confirmText}
          </button>
          <button className="btn btn-muted" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
