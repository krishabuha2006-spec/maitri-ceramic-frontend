import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const StatusBadge = ({ status }) => {
  if (!status) return null;

  let badgeClass = 'badge-secondary';
  const s = String(status).toLowerCase();

  const isConfirmed = s.includes('confirm') || s === 'active' || s === 'delivered' || s === 'paid' || s === 'completed' || s === 'approved';
  const isPending = s.includes('pending') || s.includes('interested') || s.includes('dispatched') || s.includes('negotiation');
  const isDanger = s.includes('inactive') || s.includes('reject') || s.includes('expire') || s.includes('low') || s.includes('unpaid');

  if (isConfirmed) {
    badgeClass = 'badge-success';
  } else if (isPending) {
    badgeClass = 'badge-warning';
  } else if (isDanger) {
    badgeClass = 'badge-danger';
  } else {
    badgeClass = 'badge-secondary';
  }

  return (
    <span 
      className={`badge ${badgeClass}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '0.1rem 0.35rem',
        borderRadius: '4px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        fontSize: '0.65rem',
        whiteSpace: 'nowrap'
      }}
    >
      {isConfirmed && <CheckCircle2 size={10} style={{ color: '#16a34a', flexShrink: 0 }} />}
      {isPending && <Clock size={10} style={{ color: '#d97706', flexShrink: 0 }} />}
      {isDanger && <AlertCircle size={10} style={{ color: '#dc2626', flexShrink: 0 }} />}
      <span>{status}</span>
    </span>
  );
};

export default StatusBadge;
