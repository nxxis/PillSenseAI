import React from 'react';

export default function AlertModal({
  open,
  title,
  message,
  color,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 12,
          boxShadow: '0 2px 16px #0002',
          minWidth: 320,
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: 16, color: '#222' }}>{title}</h2>
        <p style={{ color: color ? color : '#222', marginBottom: 24 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button className="btn" onClick={onConfirm} style={{ minWidth: 100 }}>
            {confirmText}
          </button>
          {cancelText && (
            <button
              className="btn btn-muted"
              onClick={onCancel}
              style={{ minWidth: 100 }}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
