import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { MODULE_LIST } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';

export const AccessDenied = ({ moduleId, action = 'view' }) => {
  const { currentUser } = useAuth();
  const moduleInfo = MODULE_LIST.find(m => m.id === moduleId);
  const moduleName = moduleInfo?.label || (moduleId ? moduleId.charAt(0).toUpperCase() + moduleId.slice(1) : 'Requested Page');

  const actionText = action === 'create' 
    ? 'create new records in'
    : action === 'edit'
    ? 'modify records in'
    : action === 'delete'
    ? 'delete records in'
    : 'access';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '65vh',
      padding: '2rem 1.5rem',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #fee2e2',
        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)',
        padding: '2.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Icon */}
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          backgroundColor: '#fef2f2',
          border: '2px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          marginBottom: '1.25rem'
        }}>
          <ShieldAlert size={36} />
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 800,
          color: '#0f172a',
          margin: '0 0 0.5rem 0'
        }}>
          Access Restricted
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '0.9rem',
          color: '#64748b',
          lineHeight: '1.5',
          margin: '0 0 1.25rem 0'
        }}>
          You do not have permission to {actionText} <strong>{moduleName}</strong>. 
          Your staff account (<strong>{currentUser?.role || 'User'}</strong>) has not been granted this permission.
        </p>

        {/* Info Box */}
        <div style={{
          width: '100%',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          fontSize: '0.8rem',
          color: '#475569',
          textAlign: 'left',
          marginBottom: '1.75rem'
        }}>
          <div><strong>Logged in as:</strong> {currentUser?.name || 'Staff'} ({currentUser?.email || currentUser?.mobile || '-'})</div>
          <div style={{ marginTop: '0.25rem' }}><strong>Assigned Role:</strong> {currentUser?.role || 'Standard User'}</div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            If you need access to this feature, please contact your Super Admin.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary"
            style={{
              padding: '0.6rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '9px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>

          <Link
            to="/"
            className="btn btn-primary"
            style={{
              padding: '0.6rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '9px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}
          >
            <Home size={16} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
