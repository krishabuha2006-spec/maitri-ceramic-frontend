import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

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
  confirmLabel = 'Delete',
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
        <div className={`confirm-modal-icon ${danger ? 'confirm-modal-icon--danger' : 'confirm-modal-icon--info'}`}>
          {danger ? <AlertTriangle size={26} /> : <AlertTriangle size={26} />}
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
        <p className="confirm-modal-message">{message}</p>

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
            onClick={onConfirm}
            autoFocus
          >
            {danger && <Trash2 size={15} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
