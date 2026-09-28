import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle2, X } from 'lucide-react';

/**
 * Premium ConfirmModal — replaces browser window.confirm()
 * Props:
 *   isOpen     {boolean}  - whether modal is visible
 *   title      {string}   - modal heading
 *   message    {string}   - body text
 *   onConfirm  {fn}       - called on confirm click
 *   onCancel   {fn}       - called on cancel or backdrop click
 *   confirmLabel {string} - button label (default: "Delete")
 *   cancelLabel  {string} - cancel label (default: "Cancel")
 *   danger     {boolean}  - red confirm button (default: true)
 */
const ConfirmModal = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="confirm-modal-box">
        {/* Icon */}
        <div className={`confirm-modal-icon ${danger ? 'confirm-modal-icon--danger' : 'confirm-modal-icon--info'}`} style={!danger ? { backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#86efac' } : {}}>
          {danger ? <AlertTriangle size={26} /> : <CheckCircle2 size={26} />}
        </div>

        {/* Close X */}
        <button
          className="confirm-modal-close"
          onClick={onCancel}
          aria-label="Close"
          type="button"
        >
          <X size={17} />
        </button>

        {/* Content */}
        <h2 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h2>
        <p className="confirm-modal-message" style={{ whiteSpace: 'pre-line' }}>{message}</p>

        {/* Actions */}
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn btn-secondary confirm-modal-cancel-btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn confirm-modal-confirm-btn ${danger ? 'confirm-modal-confirm-btn--danger' : 'confirm-modal-confirm-btn--primary'}`}
            style={!danger ? { backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' } : { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
            onClick={onConfirm}
            autoFocus
          >
            {danger ? <Trash2 size={15} /> : <CheckCircle2 size={15} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
