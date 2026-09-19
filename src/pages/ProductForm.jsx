import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Package, Percent, DollarSign, Layers, 
  CheckCircle2, AlertCircle, Save, RefreshCw, Info,
  UploadCloud, Trash2, Link as LinkIcon, FileImage, Building, Plus, X
} from 'lucide-react';
import { 
  getProductById, createProduct, updateProduct, 
  getCompanies, createCompany, 
  getProductGroups, createProductGroup 
} from '../services/productService';
import { getUnits } from '../services/masterService';

export const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    productName: '',
    company: '',
    companyId: '',
    productGroup: '',
    productGroupId: '',
    hsnCode: '69072100',
    sku: '',
    vendorSku: '',
    companySku: '',
    unit: '',
    unitId: '',
    image: '',
    gstPercent: 18,
    igstPercent: 18,
    cgstPercent: 9,
    sgstPercent: 9,
    cessPercent: 0,
    mrp: '',
    purchaseRate: '',
    costRate: '',
    salePrice: '',
    saleDiscount: 0,
    openingStock: 0,
    openingStockValue: 0,
    defaultQty: 1,
    reorderLevel: 10,
    alertStockQty: 10,
    status: 'Active'
  });

  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'url'
  const [dragActive, setDragActive] = useState(false);
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [formErrorSummary, setFormErrorSummary] = useState('');

  // Dynamic live master lists from backend
  const [companies, setCompanies] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyFormError, setCompanyFormError] = useState('');
  const [companyFormData, setCompanyFormData] = useState({
    companyName: '',
    code: '',
    isOwnCompany: false,
    status: 'Active'
  });

  const [productGroups, setProductGroups] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupFormError, setGroupFormError] = useState('');
  const [groupFormData, setGroupFormData] = useState({
    groupName: '',
    groupCode: '',
    description: '',
    parentGroup: '',
    status: 'Active'
  });

  useEffect(() => {
    Promise.all([
      getCompanies(),
      getProductGroups(),
      getUnits()
    ]).then(([comps, grps, units]) => {
      const validComps = Array.isArray(comps) ? comps : [];
      const validGrps = Array.isArray(grps) ? grps : [];
      const validUnits = Array.isArray(units) ? units : [];

      setCompanies(validComps);
      setProductGroups(validGrps);
      setAvailableUnits(validUnits);

      if (!isEdit) {
        setFormData(prev => {
          const defaultComp = validComps[0];
          const defaultGrp = validGrps[0];
          const defaultUnit = validUnits[0];

          const compName = prev.company || defaultComp?.companyName || defaultComp?.name || '';
          const compId = prev.companyId || defaultComp?._id || defaultComp?.id || '';
          const grpName = prev.productGroup || defaultGrp?.groupName || defaultGrp?.name || '';
          const grpId = prev.productGroupId || defaultGrp?._id || defaultGrp?.id || '';
          const unitName = prev.unit || defaultUnit?.unitCode || defaultUnit?.unitName || '';
          const unitId = prev.unitId || defaultUnit?._id || defaultUnit?.id || '';

          const generatedSku = prev.sku || generateAutoSku(compName, grpName, prev.productName);

          return {
            ...prev,
            company: compName,
            companyId: compId,
            productGroup: grpName,
            productGroupId: grpId,
            unit: unitName,
            unitId: unitId,
            sku: generatedSku
          };
        });
      }
    }).catch(err => {
      console.error('Failed to load master data from live backend:', err);
    });
  }, [isEdit]);

  const handleOpenGroupModal = () => {
    setGroupFormError('');
    setGroupFormData({ groupName: '', groupCode: '', description: '', parentGroup: '', status: 'Active' });
    setShowGroupModal(true);
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    setGroupFormError('');

    if (!groupFormData.groupName.trim()) {
      setGroupFormError('Please enter Product Group Name.');
      return;
    }

    setSavingGroup(true);
    try {
      const newGrp = await createProductGroup({
        groupName: groupFormData.groupName.trim(),
        description: groupFormData.description.trim(),
        status: groupFormData.status
      });

      const addedName = newGrp?.groupName || groupFormData.groupName.trim();
      const addedId = newGrp?._id || newGrp?.id;

      const refreshedGroups = await getProductGroups();
      setProductGroups(refreshedGroups);

      setFormData(prev => ({
        ...prev,
        productGroup: addedName,
        productGroupId: addedId || prev.productGroupId
      }));
      setShowGroupModal(false);
      setSuccessToast(`Product Group "${addedName}" added.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      setGroupFormError(err.message || 'Failed to create product group.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleOpenCompanyModal = () => {
    setCompanyFormError('');
    setCompanyFormData({ companyName: '', code: '', isOwnCompany: false, status: 'Active' });
    setShowCompanyModal(true);
  };

  const handleCreateCompanySubmit = async (e) => {
    e.preventDefault();
    setCompanyFormError('');

    if (!companyFormData.companyName.trim()) {
      setCompanyFormError('Please enter Company / Brand Name.');
      return;
    }

    setSavingCompany(true);
    try {
      const newComp = await createCompany({
        companyName: companyFormData.companyName.trim(),
        isOwnCompany: companyFormData.isOwnCompany,
        status: companyFormData.status
      });

      const addedName = newComp?.companyName || companyFormData.companyName.trim();
      const addedId = newComp?._id || newComp?.id;

      const refreshedCompanies = await getCompanies();
      setCompanies(refreshedCompanies);

      setFormData(prev => ({
        ...prev,
        company: addedName,
        companyId: addedId || prev.companyId
      }));
      setSuccessToast(`Company / Brand "${addedName}" created successfully!`);
      setTimeout(() => setSuccessToast(''), 3000);
      setShowCompanyModal(false);
    } catch (err) {
      setCompanyFormError(err.message || 'Failed to create company.');
    } finally {
      setSavingCompany(false);
    }
  };

  // Automatic SKU Generator Logic
  const generateAutoSku = (company, productGroup, productName) => {
    const brandCode = (company || 'GEN').substring(0, 3).toUpperCase();
    
    const groupWords = (productGroup || 'TILE').split(' ');
    const groupCode = groupWords.length > 1 
      ? groupWords.map(w => w[0]).join('').substring(0, 3).toUpperCase()
      : groupWords[0].substring(0, 3).toUpperCase();

    let nameCode = '';
    if (productName) {
      const dimMatch = productName.match(/(\d{2,4})\s*[xX*]\s*(\d{2,4})/);
      if (dimMatch) {
        nameCode = `${dimMatch[1].slice(-2)}${dimMatch[2].slice(-2)}`;
      } else {
        const words = productName.trim().split(/\s+/);
        const cleanWord = words.find(w => w.length >= 3 && !['glazed', 'vitrified', 'tile', 'tiles'].includes(w.toLowerCase())) || words[0];
        nameCode = cleanWord.substring(0, 4).toUpperCase();
      }
    }

    if (!nameCode) {
      nameCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    return `${brandCode}-${groupCode}-${nameCode}`;
  };

  // Real-time Auto SKU Update when Brand, Product Group, or Product Name changes
  useEffect(() => {
    if (!isEdit && !isSkuManuallyEdited) {
      const autoSku = generateAutoSku(formData.company, formData.productGroup, formData.productName);
      setFormData(prev => ({ ...prev, sku: autoSku }));
    }
  }, [formData.company, formData.productGroup, formData.productName, isEdit, isSkuManuallyEdited]);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getProductById(id)
        .then(data => {
          if (data) {
            setFormData(prev => ({
              ...prev,
              ...data,
              companyId: data.companyId || prev.companyId,
              productGroupId: data.productGroupId || prev.productGroupId,
              unitId: data.unitId || prev.unitId,
              gstPercent: data.gstPercent ?? 18,
              igstPercent: data.igstPercent ?? data.gstPercent ?? 18,
              cgstPercent: data.cgstPercent ?? (data.gstPercent ? data.gstPercent / 2 : 9),
              sgstPercent: data.sgstPercent ?? (data.gstPercent ? data.gstPercent / 2 : 9)
            }));
            if (data.image && data.image.startsWith('http')) {
              setUploadMode('url');
            }
            setIsSkuManuallyEdited(true);
          }
        })
        .catch(err => {
          console.error(err);
          setFormErrorSummary('Failed to load product details.');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  // Image Upload Handler with Canvas Compression (keeps size < 100KB, avoiding 413 Content Too Large)
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'Please select a valid image file (JPG, PNG, WebP, etc.).' }));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Image size should be less than 15MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result;
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setFormData(prev => ({ ...prev, image: compressedDataUrl }));
        } catch (canvasErr) {
          setFormData(prev => ({ ...prev, image: rawDataUrl }));
        }
        setErrors(prev => ({ ...prev, image: '' }));
        setTouched(prev => ({ ...prev, image: true }));
      };
      img.onerror = () => {
        setFormData(prev => ({ ...prev, image: rawDataUrl }));
        setErrors(prev => ({ ...prev, image: '' }));
        setTouched(prev => ({ ...prev, image: true }));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Field Level Validation Rule Engine
  const validateField = (name, value, allData = formData) => {
    let err = '';

    switch (name) {
      case 'productName':
        if (!value || !value.toString().trim()) {
          err = 'Product Name is required.';
        } else if (value.toString().trim().length < 3) {
          err = 'Product Name must be at least 3 characters.';
        }
        break;

      case 'sku':
        if (!value || !value.toString().trim()) {
          err = 'System SKU is required.';
        } else if (!/^[A-Za-z0-9\-_/.]+$/.test(value.toString().trim())) {
          err = 'SKU contains invalid characters. Use letters, numbers, hyphens, or slashes.';
        }
        break;

      case 'company':
        if (!value) err = 'Company / Brand selection is required.';
        break;

      case 'productGroup':
        if (!value) err = 'Product Group selection is required.';
        break;

      case 'hsnCode':
        if (value && !/^\d{4,8}$/.test(value.toString().trim())) {
          err = 'HSN Code must be between 4 and 8 numeric digits.';
        }
        break;

      case 'unit':
        if (!value) err = 'Measurement Unit is required.';
        break;

      case 'salePrice':
        if (value === '' || value === null || isNaN(value)) {
          err = 'Sale Price is required.';
        } else if (Number(value) <= 0) {
          err = 'Sale Price must be greater than ₹0.';
        }
        break;

      case 'mrp':
        if (value !== '' && Number(value) < 0) {
          err = 'MRP cannot be negative.';
        } else if (value !== '' && Number(value) > 0 && Number(value) < Number(allData.salePrice || 0)) {
          err = 'MRP should generally be equal to or greater than Sale Price.';
        }
        break;

      case 'purchaseRate':
        if (value !== '' && Number(value) < 0) {
          err = 'Purchase rate cannot be negative.';
        }
        break;

      case 'costRate':
        if (value !== '' && Number(value) < 0) {
          err = 'Cost rate cannot be negative.';
        }
        break;

      case 'gstPercent':
        if (value === '' || isNaN(value) || Number(value) < 0 || Number(value) > 100) {
          err = 'GST % must be between 0% and 100%.';
        }
        break;

      case 'image':
        if (value && uploadMode === 'url' && !/^(https?:\/\/|\/|\.\/)[^\s]+$/i.test(value.trim())) {
          err = 'Image must be a valid HTTP/HTTPS URL or path.';
        }
        break;

      default:
        break;
    }

    return err;
  };

  const validateAll = () => {
    const newErrors = {};
    const fieldsToValidate = ['productName', 'sku', 'company', 'productGroup', 'hsnCode', 'unit', 'salePrice', 'mrp', 'purchaseRate', 'gstPercent', 'image'];
    
    fieldsToValidate.forEach(field => {
      const errorMsg = validateField(field, formData[field], formData);
      if (errorMsg) {
        newErrors[field] = errorMsg;
      }
    });

    setErrors(newErrors);
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const parsedVal = type === 'number' ? (value === '' ? '' : Number(value)) : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: parsedVal };

      // Auto Tax Synchronization when GST% changes
      if (name === 'gstPercent' && parsedVal !== '') {
        const gstNum = Number(parsedVal) || 0;
        updated.igstPercent = gstNum;
        updated.cgstPercent = Number((gstNum / 2).toFixed(2));
        updated.sgstPercent = Number((gstNum / 2).toFixed(2));
      }

      // Auto Cost Rate sync if purchaseRate updated and costRate untouched
      if (name === 'purchaseRate' && (!prev.costRate || prev.costRate === prev.purchaseRate)) {
        updated.costRate = parsedVal;
      }

      // Auto Opening Stock Value calculation
      if (name === 'openingStock' || name === 'costRate' || name === 'purchaseRate') {
        const qty = name === 'openingStock' ? Number(parsedVal) : Number(prev.openingStock || 0);
        const rate = name === 'costRate' ? Number(parsedVal) : Number(updated.costRate || updated.purchaseRate || 0);
        updated.openingStockValue = Number((qty * rate).toFixed(2));
      }

      // Re-validate current field in real time
      if (touched[name]) {
        const err = validateField(name, parsedVal, updated);
        setErrors(prevErr => ({ ...prevErr, [name]: err }));
      }

      return updated;
    });
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const err = validateField(name, value, formData);
    setErrors(prevErr => ({ ...prevErr, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrorSummary('');

    // Mark all inputs as touched for validation highlight
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);

    const validationErrors = validateAll();
    const hasError = Object.values(validationErrors).some(err => err);

    if (hasError) {
      setFormErrorSummary('Please correct the highlighted errors in the form before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      const isMongoId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v.trim());
      const matchedCompany = companies.find(c => (c.companyName || c.name) === formData.company || c.id === formData.company || c._id === formData.company);
      const matchedGroup = productGroups.find(g => (g.groupName || g.name) === formData.productGroup || g.id === formData.productGroup || g._id === formData.productGroup);
      const matchedUnit = availableUnits.find(u => (u.unitCode || u.unitName) === formData.unit || u.id === formData.unit || u._id === formData.unit);

      const resolvedCompanyId = isMongoId(matchedCompany?._id) ? matchedCompany._id : (isMongoId(matchedCompany?.id) ? matchedCompany.id : (isMongoId(formData.companyId) ? formData.companyId : undefined));
      const resolvedGroupId = isMongoId(matchedGroup?._id) ? matchedGroup._id : (isMongoId(matchedGroup?.id) ? matchedGroup.id : (isMongoId(formData.productGroupId) ? formData.productGroupId : undefined));
      const resolvedUnitId = isMongoId(matchedUnit?._id) ? matchedUnit._id : (isMongoId(matchedUnit?.id) ? matchedUnit.id : (isMongoId(formData.unitId) ? formData.unitId : undefined));

      const submissionData = {
        ...formData,
        companyId: resolvedCompanyId,
        productGroupId: resolvedGroupId,
        unitId: resolvedUnitId
      };

      if (isEdit) {
        await updateProduct(id, submissionData);
        setSuccessToast('Product updated successfully!');
      } else {
        await createProduct(submissionData);
        setSuccessToast('Product created successfully!');
      }

      setTimeout(() => {
        navigate('/products');
      }, 900);
    } catch (err) {
      console.error(err);
      setFormErrorSummary(err.message || 'Failed to save product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate Profit Margin %
  const calculateMargin = () => {
    const sale = Number(formData.salePrice || 0);
    const cost = Number(formData.costRate || formData.purchaseRate || 0);
    if (!sale || sale <= 0) return null;
    const margin = ((sale - cost) / sale) * 100;
    return margin.toFixed(1);
  };

  const profitMargin = calculateMargin();

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
        <h3 style={{ color: '#0f172a', fontWeight: 600 }}>Loading product data...</h3>
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
      {/* Success Toast */}
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
          fontWeight: 600,
          animation: 'fadeInDown 0.3s ease'
        }}>
          <CheckCircle2 size={22} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Navigation */}
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
            to="/products" 
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
            <span>Back</span>
          </Link>

          <div>
            <h1 style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              {isEdit ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.2rem 0 0 0' }}>
              Configure master product details, GST tax rates, pricing and inventory alerts.
            </p>
          </div>
        </div>
      </div>

      {/* Top Form Error Summary */}
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
          fontWeight: 500,
          marginBottom: '1.5rem',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
          <div>{formErrorSummary}</div>
        </div>
      )}

      {/* Main Centered Form Container */}
      <form onSubmit={handleSubmit} noValidate>

        {/* 1. PRODUCT INFORMATION CARD */}
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
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Product Information
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Basic identification, SKU codes, manufacturer brand and categories
              </p>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            
            {/* Product Name */}
            <div className="form-group" style={{ gridColumn: 'span 8' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Product Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="productName"
                className="form-control"
                placeholder="e.g. Glazed Vitrified Tile 600x1200mm Statuario"
                value={formData.productName}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.productName && errors.productName ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.productName && errors.productName && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.productName}</span>
                </div>
              )}
            </div>

            {/* System SKU (Automatic Generation + Re-roll icon) */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', marginBottom: '0.4rem', display: 'block' }}>
                System SKU <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="sku"
                  className="form-control"
                  placeholder="Auto-generated SKU"
                  value={formData.sku}
                  onChange={(e) => {
                    setIsSkuManuallyEdited(true);
                    handleChange(e);
                  }}
                  onBlur={handleBlur}
                  style={{
                    height: '46px',
                    borderRadius: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    paddingRight: '2.5rem',
                    borderColor: touched.sku && errors.sku ? '#f87171' : '#cbd5e1'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsSkuManuallyEdited(false);
                    const auto = generateAutoSku(formData.company, formData.productGroup, formData.productName);
                    setFormData(prev => ({ ...prev, sku: auto }));
                  }}
                  title="Re-generate automatic SKU code"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
              {touched.sku && errors.sku && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.sku}</span>
                </div>
              )}
            </div>

            {/* Company / Brand */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                  Company / Brand <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={handleOpenCompanyModal}
                  style={{
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    lineHeight: 1
                  }}
                  title="Create New Company Master Record"
                >
                  <Plus size={13} />
                  <span>Create Company</span>
                </button>
              </div>
              <select
                name="company"
                className="form-control"
                value={formData.company}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW__') {
                    handleOpenCompanyModal();
                  } else {
                    const selectedName = e.target.value;
                    const found = companies.find(c => (c.companyName || c.name) === selectedName || (c._id || c.id) === selectedName);
                    setFormData(prev => ({
                      ...prev,
                      company: selectedName,
                      companyId: found?._id || found?.id || prev.companyId
                    }));
                  }
                }}
                onBlur={handleBlur}
                style={{ height: '46px', borderRadius: '10px' }}
              >
                {companies.length === 0 && <option value="">Loading live companies...</option>}
                {companies.map(c => (
                  <option key={c._id || c.id || c.companyName} value={c.companyName}>
                    {c.companyName} {c.isOwnCompany ? '(Own)' : ''}
                  </option>
                ))}
                <option value="__ADD_NEW__" style={{ fontWeight: 700, color: '#2563eb' }}>+ Add New Company...</option>
              </select>
            </div>

            {/* Product Group */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                  Product Group <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={handleOpenGroupModal}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '6px',
                    lineHeight: 1
                  }}
                  title="Create New Product Group Record"
                >
                  <Plus size={13} />
                  <span>Create Group</span>
                </button>
              </div>
              <select
                name="productGroup"
                className="form-control"
                value={formData.productGroup}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW_GROUP__') {
                    handleOpenGroupModal();
                  } else {
                    const selectedName = e.target.value;
                    const found = productGroups.find(g => (g.groupName || g.name) === selectedName || (g._id || g.id) === selectedName);
                    setFormData(prev => ({
                      ...prev,
                      productGroup: selectedName,
                      productGroupId: found?._id || found?.id || prev.productGroupId
                    }));
                  }
                }}
                onBlur={handleBlur}
                style={{ height: '46px', borderRadius: '10px' }}
              >
                {productGroups.length === 0 && <option value="">Loading live groups...</option>}
                {productGroups.map(g => (
                  <option key={g._id || g.id || g.groupName} value={g.groupName}>{g.groupName}</option>
                ))}
                <option value="__ADD_NEW_GROUP__" style={{ fontWeight: 700, color: '#2563eb' }}>+ Add New Group...</option>
              </select>
            </div>

            {/* HSN Code */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                HSN Code
              </label>
              <input
                type="text"
                name="hsnCode"
                className="form-control"
                placeholder="69072100"
                value={formData.hsnCode}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.hsnCode && errors.hsnCode ? '#f87171' : '#cbd5e1'
                }}
              />
              {touched.hsnCode && errors.hsnCode && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                  <AlertCircle size={14} /> <span>{errors.hsnCode}</span>
                </div>
              )}
            </div>

            {/* Vendor SKU */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Vendor SKU
              </label>
              <input
                type="text"
                name="vendorSku"
                className="form-control"
                placeholder="Vendor item code"
                value={formData.vendorSku}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Company SKU */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Company SKU
              </label>
              <input
                type="text"
                name="companySku"
                className="form-control"
                placeholder="Brand catalog code"
                value={formData.companySku}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Measurement Unit */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Measurement Unit <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                name="unit"
                className="form-control"
                value={formData.unit}
                onChange={(e) => {
                  const selectedVal = e.target.value;
                  const found = availableUnits.find(u => u.unitCode === selectedVal || u.unitName === selectedVal || (u._id || u.id) === selectedVal);
                  setFormData(prev => ({
                    ...prev,
                    unit: selectedVal,
                    unitId: found?._id || found?.id || prev.unitId
                  }));
                }}
                style={{ height: '46px', borderRadius: '10px' }}
              >
                {availableUnits.length > 0 ? (
                  availableUnits.map(u => (
                    <option key={u._id || u.id || u.unitCode} value={u.unitCode}>
                      {u.unitCode} ({u.unitName})
                    </option>
                  ))
                ) : (
                  <option value="">Loading live units...</option>
                )}
              </select>
            </div>

            {/* Product Image Uploader (File Upload / Drag & Drop / Image URL) */}
            <div className="form-group" style={{ gridColumn: 'span 12' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  Product Image
                </label>
                
                {/* Upload Mode Switcher Tabs */}
                <div style={{ display: 'flex', gap: '0.3rem', backgroundColor: '#f1f5f9', padding: '0.2rem', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    style={{
                      border: 'none',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      backgroundColor: uploadMode === 'file' ? '#ffffff' : 'transparent',
                      color: uploadMode === 'file' ? '#2563eb' : '#64748b',
                      boxShadow: uploadMode === 'file' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <UploadCloud size={13} />
                    <span>Upload File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('url')}
                    style={{
                      border: 'none',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      backgroundColor: uploadMode === 'url' ? '#ffffff' : 'transparent',
                      color: uploadMode === 'url' ? '#2563eb' : '#64748b',
                      boxShadow: uploadMode === 'url' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <LinkIcon size={13} />
                    <span>Image URL</span>
                  </button>
                </div>
              </div>

              {/* Display Attached Image Preview Box */}
              {formData.image ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px'
                }}>
                  <div style={{
                    width: '85px',
                    height: '85px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    flexShrink: 0
                  }}>
                    <img
                      src={formData.image}
                      alt="Product Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=200&auto=format&fit=crop&q=60'; }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>
                      Product Image Attached
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                      {formData.image.startsWith('data:') ? 'Local file uploaded successfully (Base64 format)' : formData.image}
                    </p>

                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.65rem' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#2563eb',
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <FileImage size={13} /> Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#dc2626',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {uploadMode === 'file' ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${dragActive ? '#2563eb' : '#cbd5e1'}`,
                        borderRadius: '12px',
                        padding: '1.75rem 1rem',
                        textAlign: 'center',
                        backgroundColor: dragActive ? '#eff6ff' : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <UploadCloud size={36} style={{ color: dragActive ? '#2563eb' : '#94a3b8', marginBottom: '0.4rem' }} />
                      <p style={{ margin: 0, fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                        Click to browse file or drag & drop product image here
                      </p>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                        Supports JPG, PNG, WebP or GIF (Max 5MB)
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <input
                        type="text"
                        name="image"
                        className="form-control"
                        placeholder="Paste image URL (e.g. https://images.unsplash.com/...)"
                        value={formData.image}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        style={{ height: '46px', borderRadius: '10px' }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                style={{ display: 'none' }}
              />

              {touched.image && errors.image && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.35rem' }}>
                  <AlertCircle size={14} /> <span>{errors.image}</span>
                </div>
              )}
            </div>

          </div>
        </div>


        {/* 2. TAX INFORMATION CARD */}
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
              <Percent size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Tax Information (GST Slabs)
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Configured GST percentage automatically splits CGST & SGST (50% each) and IGST.
              </p>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            
            {/* GST % */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                GST % <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                name="gstPercent"
                className="form-control"
                value={formData.gstPercent}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  borderColor: touched.gstPercent && errors.gstPercent ? '#f87171' : '#cbd5e1'
                }}
              />
            </div>

            {/* IGST % */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#64748b' }}>
                IGST %
              </label>
              <input
                type="number"
                name="igstPercent"
                className="form-control"
                value={formData.igstPercent}
                readOnly
                style={{ height: '46px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 600 }}
              />
            </div>

            {/* CGST % */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#64748b' }}>
                CGST %
              </label>
              <input
                type="number"
                name="cgstPercent"
                className="form-control"
                value={formData.cgstPercent}
                readOnly
                style={{ height: '46px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 600 }}
              />
            </div>

            {/* SGST % */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#64748b' }}>
                SGST %
              </label>
              <input
                type="number"
                name="sgstPercent"
                className="form-control"
                value={formData.sgstPercent}
                readOnly
                style={{ height: '46px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#475569', fontWeight: 600 }}
              />
            </div>

            {/* CESS % */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                CESS %
              </label>
              <input
                type="number"
                name="cessPercent"
                className="form-control"
                value={formData.cessPercent}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

          </div>
          {touched.gstPercent && errors.gstPercent && (
            <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
              <AlertCircle size={14} /> <span>{errors.gstPercent}</span>
            </div>
          )}
        </div>


        {/* 3. PRICING CARD */}
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
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                <DollarSign size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Pricing & Profit Margins
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Set purchasing rates, MRP and selling price.
                </p>
              </div>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            
            {/* MRP */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                MRP (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="mrp"
                className="form-control"
                placeholder="0.00"
                value={formData.mrp}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  borderColor: touched.mrp && errors.mrp ? '#f87171' : '#cbd5e1'
                }}
              />
            </div>

            {/* Purchase Rate */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Purchase Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="purchaseRate"
                className="form-control"
                placeholder="0.00"
                value={formData.purchaseRate}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Cost Rate */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Cost Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="costRate"
                className="form-control"
                placeholder="0.00"
                value={formData.costRate}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Sale Price */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Sale Price (₹) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="salePrice"
                className="form-control"
                placeholder="0.00"
                value={formData.salePrice}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  borderColor: touched.salePrice && errors.salePrice ? '#f87171' : '#cbd5e1'
                }}
              />
            </div>

            {/* Sale Discount */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Discount %
              </label>
              <input
                type="number"
                step="0.01"
                name="saleDiscount"
                className="form-control"
                placeholder="0.0"
                value={formData.saleDiscount}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

          </div>

          {touched.salePrice && errors.salePrice && (
            <div style={{ color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
              <AlertCircle size={14} /> <span>{errors.salePrice}</span>
            </div>
          )}
          {touched.mrp && errors.mrp && (
            <div style={{ color: '#d97706', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
              <AlertCircle size={14} /> <span>{errors.mrp}</span>
            </div>
          )}
        </div>


        {/* 4. STOCK PARAMETERS CARD */}
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
              backgroundColor: '#f0f9ff',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Inventory & Stock Parameters
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Initial stock quantities, stock values, reorder alerts and default billing quantities.
              </p>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            
            {/* Opening Stock */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Opening Stock
              </label>
              <input
                type="number"
                name="openingStock"
                className="form-control"
                placeholder="0"
                value={formData.openingStock}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Opening Stock Value */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Stock Value (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="openingStockValue"
                className="form-control"
                placeholder="0.00"
                value={formData.openingStockValue}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Default Qty */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Default Qty
              </label>
              <input
                type="number"
                name="defaultQty"
                className="form-control"
                placeholder="1"
                value={formData.defaultQty}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Reorder Level */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Reorder Level
              </label>
              <input
                type="number"
                name="reorderLevel"
                className="form-control"
                placeholder="100"
                value={formData.reorderLevel}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Alert Stock Qty */}
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Alert Stock Qty
              </label>
              <input
                type="number"
                name="alertStockQty"
                className="form-control"
                placeholder="50"
                value={formData.alertStockQty}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
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
              to="/products" 
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
                  <span>{isEdit ? 'Update Product' : 'Save Product'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>

      {/* Create New Company Modal Dialog */}
      {showCompanyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '480px',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Building size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Create New Company / Brand
                  </h3>
                  <p style={{ fontSize: '0.785rem', color: '#64748b', margin: 0 }}>
                    Add a brand supplier or company master record
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateCompanySubmit}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {companyFormError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, color: '#dc2626' }} />
                    <span>{companyFormError}</span>
                  </div>
                )}

                {/* Company Name */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Company / Brand Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Somany Ceramics, Kajaria, Simpolo"
                    value={companyFormData.companyName}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, companyName: e.target.value })}
                    autoFocus
                    required
                    style={{ height: '42px', borderRadius: '8px' }}
                  />
                </div>

                {/* Company Code / Prefix */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Brand Code / Prefix (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. KJR, SMN, SMP"
                    value={companyFormData.code}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, code: e.target.value.toUpperCase() })}
                    style={{ height: '42px', borderRadius: '8px', fontFamily: 'monospace' }}
                  />
                </div>

                {/* Is Own Company Checkbox */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}>
                  <input
                    type="checkbox"
                    id="isOwnCompanyCheck"
                    checked={companyFormData.isOwnCompany}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, isOwnCompany: e.target.checked })}
                    style={{ width: '17px', height: '17px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <label htmlFor="isOwnCompanyCheck" style={{ cursor: 'pointer', margin: 0, fontSize: '0.835rem', fontWeight: 600, color: '#334155' }}>
                    This is our Own Primary Company (Max 1 allowed)
                  </label>
                </div>

                {/* Account Status */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Status
                  </label>
                  <select
                    className="form-control"
                    value={companyFormData.status}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, status: e.target.value })}
                    style={{ height: '42px', borderRadius: '8px', fontWeight: 600 }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #f1f5f9',
                backgroundColor: '#f8fafc'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCompany}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1.35rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  {savingCompany ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save & Add Company</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Product Group Modal Dialog */}
      {showGroupModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '520px',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Layers size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Create New Product Group
                  </h3>
                  <p style={{ fontSize: '0.785rem', color: '#64748b', margin: 0 }}>
                    Add a category or material group classification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateGroupSubmit}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {groupFormError && (
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <AlertCircle size={15} />
                    <span>{groupFormError}</span>
                  </div>
                )}

                {/* Group Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Product Group Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Marble Finish Tiles, Brass Fittings..."
                    value={groupFormData.groupName}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, groupName: e.target.value }))}
                    style={{ height: '42px', borderRadius: '8px' }}
                    required
                  />
                </div>

                {/* Group Code */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Group Code / Prefix
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MFT, BF"
                    value={groupFormData.groupCode}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, groupCode: e.target.value.toUpperCase() }))}
                    style={{ height: '42px', borderRadius: '8px' }}
                  />
                </div>

                {/* Parent Group */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Parent Group (Hierarchical Category)
                  </label>
                  <select
                    className="form-control"
                    value={groupFormData.parentGroup}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, parentGroup: e.target.value }))}
                    style={{ height: '42px', borderRadius: '8px' }}
                  >
                    <option value="">None (Top-Level Category)</option>
                    {productGroups.map(g => (
                      <option key={g.id || g.groupName} value={g.groupName}>{g.groupName}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Status
                  </label>
                  <select
                    className="form-control"
                    value={groupFormData.status}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, status: e.target.value }))}
                    style={{ height: '42px', borderRadius: '8px' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #f1f5f9',
                backgroundColor: '#f8fafc'
              }}>
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1.35rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  {savingGroup ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save & Select Group</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductForm;
