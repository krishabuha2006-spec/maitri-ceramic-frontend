import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, User, MapPin, Building, FileText, CheckCircle2, 
  AlertCircle, Save, RefreshCw, ChevronDown, Search, Check 
} from 'lucide-react';
import { getCustomerById, createCustomer, updateCustomer } from '../services/customerService';

const GUJARAT_CITIES = [
  'Ahmedabad',
  'Surat',
  'Vadodara',
  'Rajkot',
  'Morbi',
  'Gandhinagar',
  'Bhavnagar',
  'Jamnagar',
  'Junagadh',
  'Anand',
  'Nadiad',
  'Mehsana',
  'Bharuch',
  'Ankleshwar',
  'Vapi',
  'Navsari',
  'Valsad',
  'Porbandar',
  'Surendranagar',
  'Bhuj',
  'Gandhidham',
  'Palanpur',
  'Patan',
  'Amreli',
  'Dahod',
  'Godhra',
  'Veraval',
  'Botad',
  'Gondal',
  'Jetpur',
  'Kadi',
  'Kalol',
  'Kapadvanj',
  'Modasa',
  'Pardi',
  'Sanand',
  'Unjha',
  'Viramgam',
  'Vyara'
];

const CitySelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const filteredCities = GUJARAT_CITIES.filter(c => 
    c.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="form-control"
        style={{
          height: '46px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          backgroundColor: '#ffffff',
          borderColor: isOpen ? '#2563eb' : '#cbd5e1',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
          padding: '0 0.9rem',
          userSelect: 'none'
        }}
      >
        <span style={{ color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, fontSize: '0.875rem' }}>
          {value || 'Select City'}
        </span>
        <ChevronDown size={18} style={{ color: '#64748b', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 999,
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
          overflow: 'hidden',
          padding: '0.5rem'
        }}>
          {/* Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 0.75rem',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '0.4rem'
          }}>
            <Search size={15} style={{ color: '#64748b', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search Gujarat city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.85rem',
                color: '#0f172a'
              }}
            />
          </div>

          {/* Cities Options */}
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {filteredCities.length > 0 ? (
              filteredCities.map(city => (
                <div
                  key={city}
                  onClick={() => {
                    onChange(city);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: value === city ? '#eff6ff' : 'transparent',
                    color: value === city ? '#2563eb' : '#334155',
                    fontWeight: value === city ? 600 : 400
                  }}
                  onMouseEnter={(e) => { if (value !== city) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                  onMouseLeave={(e) => { if (value !== city) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span>{city}</span>
                  {value === city && <Check size={16} style={{ color: '#2563eb' }} />}
                </div>
              ))
            ) : (
              <div 
                onClick={() => {
                  if (searchTerm.trim()) {
                    onChange(searchTerm.trim());
                    setIsOpen(false);
                    setSearchTerm('');
                  }
                }}
                style={{
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.85rem',
                  color: searchTerm.trim() ? '#2563eb' : '#64748b',
                  fontWeight: searchTerm.trim() ? 600 : 400,
                  textAlign: 'center',
                  cursor: searchTerm.trim() ? 'pointer' : 'default',
                  backgroundColor: searchTerm.trim() ? '#eff6ff' : 'transparent',
                  borderRadius: '6px'
                }}
              >
                {searchTerm.trim() ? `Use "${searchTerm.trim()}"` : 'No city found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomerForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    altMobile: '',
    email: '',
    billingAddress: '',
    shippingAddress: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    gstNumber: '',
    customerType: 'Retail Individual',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [formErrorSummary, setFormErrorSummary] = useState('');

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getCustomerById(id)
        .then(data => {
          if (data) setFormData(data);
        })
        .catch(err => {
          console.error(err);
          setFormErrorSummary('Failed to load customer record.');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const validateField = (name, value) => {
    let err = '';
    const strVal = (value || '').toString().trim();

    switch (name) {
      case 'name':
        if (!strVal) {
          err = 'Customer Name is required.';
        } else if (strVal.length < 2) {
          err = 'Customer Name must be at least 2 characters.';
        }
        break;

      case 'mobile':
        if (!strVal) {
          err = 'Mobile number is required.';
        } else if (!/^\d{10,15}$/.test(strVal)) {
          err = 'Mobile number must be between 10 and 15 digits.';
        }
        break;

      case 'altMobile':
        if (strVal && !/^\d{10,15}$/.test(strVal)) {
          err = 'Alternate phone number must be between 10 and 15 digits.';
        }
        break;

      case 'email':
        if (strVal && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(strVal)) {
          err = 'Enter a valid email address.';
        }
        break;

      case 'gstNumber':
        if (strVal) {
          if (strVal.length !== 15) {
            err = 'GSTIN number must be exactly 15 characters.';
          } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(strVal)) {
            err = 'Enter a valid 15-character GSTIN format (e.g. 24AAAAA0000A1Z5).';
          }
        }
        break;

      default:
        break;
    }

    return err;
  };

  const validateAll = () => {
    const newErrors = {};
    ['name', 'mobile', 'altMobile', 'email', 'gstNumber'].forEach(field => {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field] = err;
    });
    setErrors(newErrors);
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitizedValue = value;

    if (name === 'mobile' || name === 'altMobile') {
      // Allow ONLY numbers 0-9, strip out all letters, spaces & special characters
      sanitizedValue = value.replace(/\D/g, '');
    } else if (name === 'gstNumber') {
      // Auto-uppercase and keep alphanumeric characters up to 15 chars
      sanitizedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    }

    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));

    if (touched[name]) {
      const err = validateField(name, sanitizedValue);
      setErrors(prevErr => ({ ...prevErr, [name]: err }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const err = validateField(name, value);
    setErrors(prevErr => ({ ...prevErr, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrorSummary('');

    const allTouched = Object.keys(formData).reduce((acc, k) => { acc[k] = true; return acc; }, {});
    setTouched(allTouched);

    const valErrors = validateAll();
    if (Object.values(valErrors).some(err => err)) {
      setFormErrorSummary('Please fix highlighted errors before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateCustomer(id, formData);
        setSuccessToast('Customer updated successfully!');
      } else {
        await createCustomer(formData);
        setSuccessToast('Customer created successfully!');
      }

      setTimeout(() => {
        navigate('/customers');
      }, 900);
    } catch (err) {
      console.error(err);
      setFormErrorSummary(err.message || 'Failed to save customer.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: '1020px',
        margin: '2rem auto',
        padding: '3rem',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb', marginBottom: '1rem' }} />
        <h3 style={{ color: '#0f172a', fontWeight: 600 }}>Loading customer data...</h3>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1020px',
      margin: '0 auto',
      paddingBottom: '3rem',
      fontFamily: 'var(--font-family)'
    }}>
      {/* Toast Notification */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: '#16a34a',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
          fontWeight: 600
        }}>
          <CheckCircle2 size={22} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.75rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to="/customers" 
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '10px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Customers</span>
          </Link>

          <div>
            <h1 style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0
            }}>
              {isEdit ? 'Edit Customer' : 'Add New Customer'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.2rem 0 0 0' }}>
              Add contact info, billing & shipping address, GST details and contractor category.
            </p>
          </div>
        </div>
      </div>

      {formErrorSummary && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          color: '#991b1b',
          fontSize: '0.9rem',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
          <div>{formErrorSummary}</div>
        </div>
      )}

      {/* Main Centered Form Container */}
      <form onSubmit={handleSubmit} noValidate>

        {/* 1. CUSTOMER INFO */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.75rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Customer Information
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Full name, primary mobile number and email details
              </p>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Customer Name */}
            <div className="form-group" style={{ gridColumn: 'span 8' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Customer / Business Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                className="form-control"
                placeholder="Enter customer / business name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.name && errors.name ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.name && errors.name && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.name}</span>
                </div>
              )}
            </div>

            {/* Mobile Number */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Mobile Number <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="mobile"
                inputMode="numeric"
                className="form-control"
                placeholder="Enter mobile number"
                value={formData.mobile}
                onChange={handleChange}
                onBlur={handleBlur}
                maxLength={15}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.mobile && errors.mobile ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.mobile && errors.mobile && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.mobile}</span>
                </div>
              )}
            </div>

            {/* Alternate Phone */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Alternate Phone Number
              </label>
              <input
                type="text"
                name="altMobile"
                inputMode="numeric"
                className="form-control"
                placeholder="Enter alternate phone number"
                value={formData.altMobile}
                onChange={handleChange}
                onBlur={handleBlur}
                maxLength={15}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.altMobile && errors.altMobile ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.altMobile && errors.altMobile && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.altMobile}</span>
                </div>
              )}
            </div>

            {/* Email Address */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Email Address
              </label>
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.email && errors.email ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.email && errors.email && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. ADDRESS DETAILS */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.75rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MapPin size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Address Details
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Billing and site delivery location details
              </p>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Billing Address */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Billing Address
              </label>
              <textarea
                name="billingAddress"
                className="form-control"
                rows="3"
                placeholder="Enter billing address"
                value={formData.billingAddress}
                onChange={handleChange}
                style={{ borderRadius: '10px' }}
              />
            </div>

            {/* Shipping Address */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Shipping / Site Address
              </label>
              <textarea
                name="shippingAddress"
                className="form-control"
                rows="3"
                placeholder="Enter shipping address"
                value={formData.shippingAddress}
                onChange={handleChange}
                style={{ borderRadius: '10px' }}
              />
            </div>

            {/* City */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                City
              </label>
              <CitySelect
                value={formData.city}
                onChange={(selectedCity) => {
                  setFormData(prev => ({ ...prev, city: selectedCity }));
                }}
              />
            </div>

            {/* State */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                State
              </label>
              <input
                type="text"
                name="state"
                className="form-control"
                placeholder="Enter state"
                value={formData.state}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>
          </div>
        </div>

        {/* 3. GST & CATEGORY */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.75rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#fffbe6',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                GST & Customer Category
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                GSTIN registration code & contractor classification
              </p>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* GST Number */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                GSTIN Number
              </label>
              <input
                type="text"
                name="gstNumber"
                className="form-control"
                placeholder="Enter GSTIN number"
                value={formData.gstNumber}
                onChange={handleChange}
                onBlur={handleBlur}
                maxLength={15}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  borderColor: touched.gstNumber && errors.gstNumber ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.gstNumber && errors.gstNumber && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.gstNumber}</span>
                </div>
              )}
            </div>

            {/* Customer Category */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Customer Category
              </label>
              <select
                name="customerType"
                className="form-control"
                value={formData.customerType}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              >
                <option value="Retail Individual">Retail Individual</option>
                <option value="Builder / Developer">Builder / Developer</option>
                <option value="Architect / Interior Designer">Architect / Interior Designer</option>
                <option value="Plumbing Contractor">Plumbing Contractor</option>
                <option value="Tiling Contractor">Tiling Contractor</option>
              </select>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Internal Notes / Remarks
              </label>
              <textarea
                name="notes"
                className="form-control"
                rows="2"
                placeholder="Enter internal notes"
                value={formData.notes}
                onChange={handleChange}
                style={{ borderRadius: '10px' }}
              />
            </div>
          </div>
        </div>

        {/* ACTIONS BAR */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.75rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Fields marked with <span style={{ color: '#dc2626', fontWeight: 700 }}>*</span> are required.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Link 
              to="/customers" 
              className="btn btn-secondary"
              style={{
                borderRadius: '10px',
                height: '46px',
                padding: '0 1.25rem',
                fontWeight: 600,
                fontSize: '0.925rem'
              }}
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                borderRadius: '10px',
                height: '46px',
                padding: '0 1.75rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{isEdit ? 'Update Customer' : 'Save Customer'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default CustomerForm;
