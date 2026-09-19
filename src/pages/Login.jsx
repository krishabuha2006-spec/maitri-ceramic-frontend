import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { loginWithBackend } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Form Validation Logic
  const validate = () => {
    const errors = {};
    const val = identifier.trim();

    if (!val) {
      errors.identifier = 'Mobile number or email address is required.';
    } else {
      const isMobile = /^\d+$/.test(val);
      const isEmail = val.includes('@');
      
      if (isMobile && !/^[6-9]\d{9}$/.test(val)) {
        errors.identifier = 'Enter a valid 10-digit mobile number.';
      } else if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors.identifier = 'Enter a valid email address.';
      }
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 4) {
      errors.password = 'Password must be at least 4 characters long.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const val = identifier.trim();
      const isMobile = /^\d+$/.test(val);
      const payload = {
        email: val,
        mobile: val,
        username: val,
        identifier: val,
        password
      };
      if (isMobile) {
        payload.phone = val;
      }

      const res = await loginWithBackend(payload);
      if (res && res.success) {
        navigate('/');
      } else {
        setError(res?.message || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to live backend API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: '#ffffff'
    }}>
      {/* Left 50%: Pure Image (No text over image) */}
      <div 
        className="login-left-banner"
        style={{
          flex: 1,
          width: '50%',
          backgroundImage: 'url("/ceramic-showroom-hero.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderRight: '1px solid #e2e8f0'
        }} 
      />

      {/* Right 50%: Login Form Container */}
      <div 
        className="login-form-container"
        style={{
          flex: 1,
          width: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem',
          backgroundColor: '#ffffff'
        }}
      >
        <div style={{ width: '100%', maxWidth: '450px' }}>
          {/* Header & Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <img 
              src="/Maitri-Ceramic-logo.png" 
              alt="Maitri Ceramic Logo" 
              style={{ 
                height: '60px', 
                width: 'auto', 
                maxWidth: '260px',
                objectFit: 'contain',
                filter: 'brightness(0)',
                marginBottom: '0.85rem'
              }} 
            />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Sign In to System
            </h2>
          </div>

          {/* Error Alert */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: '0.85rem 1.1rem',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              fontSize: '0.875rem',
              marginBottom: '1.5rem'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
              <div>{error}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Combined Identifier Input */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.92rem', color: '#334155', marginBottom: '0.5rem', display: 'block' }}>
                Mobile Number / Email Address <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter mobile number or email"
                  value={identifier} 
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (validationErrors.identifier) setValidationErrors(prev => ({ ...prev, identifier: '' }));
                  }}
                  style={{
                    paddingLeft: '2.85rem',
                    height: '52px',
                    fontSize: '1rem',
                    borderRadius: '10px',
                    borderColor: validationErrors.identifier ? '#f87171' : undefined
                  }}
                />
                <User size={20} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
              {validationErrors.identifier && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 500 }}>
                  {validationErrors.identifier}
                </div>
              )}
            </div>

            {/* Password Input */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.92rem', color: '#334155', marginBottom: '0.5rem', display: 'block' }}>
                Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="form-control" 
                  placeholder="Enter password"
                  value={password} 
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: '' }));
                  }}
                  style={{
                    paddingLeft: '2.85rem',
                    paddingRight: '2.85rem',
                    height: '52px',
                    fontSize: '1rem',
                    borderRadius: '10px',
                    borderColor: validationErrors.password ? '#f87171' : undefined
                  }}
                />
                <Lock size={20} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {validationErrors.password && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 500 }}>
                  {validationErrors.password}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{
                width: '100%',
                height: '52px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)'
              }} 
              disabled={loading}
            >
              <LogIn size={20} />
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>

            {/* Live Backend Super Admin Quick Fill */}
            <div style={{
              marginTop: '1.25rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '0.82rem',
              color: '#475569'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <strong style={{ color: '#0f172a' }}>Live Backend Super Admin:</strong>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('9825702369');
                    setPassword('Laksh@2508');
                    setValidationErrors({});
                  }}
                  style={{
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Autofill
                </button>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                Mobile: <strong>9825702369</strong> &bull; Pass: <strong>Laksh@2508</strong>
              </div>
            </div>
          </form>

          {/* Footer Security Badge */}
          <div style={{
            marginTop: '2.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            color: '#94a3b8',
            fontSize: '0.78rem'
          }}>
            <ShieldCheck size={15} style={{ color: '#2563eb' }} />
            <span>Customer, Billing & Inventory Management ERP</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
