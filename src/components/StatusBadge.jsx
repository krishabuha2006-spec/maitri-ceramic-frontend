import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Send, XCircle, FileText, Sparkles, MessageCircle } from 'lucide-react';

export const StatusBadge = ({ status }) => {
  if (!status) return null;

  // Clean raw status strings (remove underscores, trim, lowercase for matching)
  const raw = String(status).trim();
  const s = raw.toLowerCase().replace(/_/g, ' ');

  const isConfirmed = s.includes('confirm') || s === 'active' || s === 'delivered' || s === 'paid' || s.includes('completed') || s === 'approved';
  const isSent = s === 'sent';
  const isDraft = s === 'draft';
  const isInterested = s.includes('interest');
  const isNegotiation = s.includes('negotiat');
  const isPending = s.includes('pending') || s.includes('review') || s.includes('dispatched');
  const isRejected = s.includes('reject');
  const isExpired = s.includes('expire');
  const isClosed = s === 'closed' || s.includes('close');
  const isDanger = s.includes('inactive') || s.includes('cancel') || s.includes('low') || s.includes('unpaid');

  const baseBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.22rem 0.6rem',
    borderRadius: '6px',
    fontWeight: 700,
    letterSpacing: '0.025em',
    fontSize: '0.72rem',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase'
  };

  // When status is Confirmed or Completed, tick mark icon appears OUTSIDE the box right beside it
  if (isConfirmed) {
    const label = s.includes('confirm') ? 'CONFIRMED' : (s.includes('complete') ? 'COMPLETED' : raw.replace(/_/g, ' ').toUpperCase());
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', verticalAlign: 'middle' }}>
        <span 
          style={{
            ...baseBadgeStyle,
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#15803d'
          }}
        >
          {label}
        </span>
        <CheckCircle2 size={16} style={{ color: '#16a34a', strokeWidth: 2.4, flexShrink: 0 }} />
      </span>
    );
  }

  // Customer Interested (Clean professional blue/cyan pill)
  if (isInterested) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1d4ed8'
        }}
      >
        INTERESTED
      </span>
    );
  }

  // Negotiation (Warm amber pill)
  if (isNegotiation) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#b45309'
        }}
      >
        NEGOTIATION
      </span>
    );
  }

  // Sent status
  if (isSent) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1d4ed8'
        }}
      >
        SENT
      </span>
    );
  }

  // Draft status
  if (isDraft) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          color: '#475569'
        }}
      >
        DRAFT
      </span>
    );
  }

  // Pending status (Violet pill)
  if (isPending) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#faf5ff',
          border: '1px solid #e9d5ff',
          color: '#7e22ce'
        }}
      >
        {s.includes('follow') ? 'FOLLOW-UP PENDING' : 'PENDING'}
      </span>
    );
  }

  // Rejected status
  if (isRejected) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c'
        }}
      >
        REJECTED
      </span>
    );
  }

  // Expired status
  if (isExpired) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#fff7ed',
          border: '1px solid #fed7aa',
          color: '#c2410c'
        }}
      >
        EXPIRED
      </span>
    );
  }

  // Closed status
  if (isClosed) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          color: '#475569'
        }}
      >
        CLOSED
      </span>
    );
  }

  // Generic Danger / Inactive
  if (isDanger) {
    return (
      <span
        style={{
          ...baseBadgeStyle,
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c'
        }}
      >
        {raw.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  }

  // Default fallback badge
  return (
    <span
      style={{
        ...baseBadgeStyle,
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#334155'
      }}
    >
      {raw.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
};

export default StatusBadge;
