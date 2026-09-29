import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Package, Percent, DollarSign, Layers, 
  CheckCircle2, AlertCircle, Save, RefreshCw, Info,
  UploadCloud, Trash2, Link as LinkIcon, FileImage, Building, Plus, X, Truck,
  Tag, Ruler, Palette, Box, Hash
} from 'lucide-react';
import { 
  getProductById, createProduct, updateProduct, 
  getCompanies, createCompany, 
  getProductGroups, createProductGroup,
  getVendors, createVendor
} from '../services/productService';
import { getUnits } from '../services/masterService';
import { CATEGORIES, DEFAULT_PRODUCT_TYPES } from './ProductGroups';

export const TILE_SIZE_PRESETS = [
  '600x1200 mm',
  '800x1600 mm',
  '600x600 mm',
  '300x600 mm',
  '300x450 mm',
  '200x1200 mm',
  '800x2400 mm',
  '1200x1800 mm'
];

export const SANITARY_RANGE_PRESETS = [
  'MERIDIAN',
  'INSIGNIA',
  'W+W',
  'THE GAP',
  'ONA',
  'CARMEN',
  'INSPIRA',
  'ELEMENT',
  'DEBBA',
  'HALL'
];

export const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    productName: '',
    company: '',
    companyId: '',
    vendor: '',
    vendorId: '',
    category: 'Sanitaryware',
    productGroup: '',
    productGroupId: '',
    productType: '',
    productSubType: '',
    rangeOrSize: '',
    range: '',
    size: '',
    colourName: 'White',
    finish: 'Glossy',
    fullDescription: '',
    piecesPerBox: '',
    sqftPerBox: '',
    weightPerBox: '',
    hsnCode: '69109000',
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
  const [productGroups, setProductGroups] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Quick Company Modal
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyFormError, setCompanyFormError] = useState('');
  const [companyFormData, setCompanyFormData] = useState({
    companyName: '',
    code: '',
    isOwnCompany: false,
    status: 'Active'
  });

  // Quick Product Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [typeFormError, setTypeFormError] = useState('');
  const [typeFormData, setTypeFormData] = useState({
    groupName: '',
    category: 'Sanitaryware',
    subTypes: [],
    subTypeInput: '',
    description: '',
    status: 'Active'
  });

  // Load masters & edit product
  useEffect(() => {
    Promise.all([
      getCompanies().catch(() => []),
      getProductGroups().catch(() => []),
      getUnits().catch(() => []),
      getVendors().catch(() => [])
    ]).then(([comps, grps, units, vends]) => {
      const validComps = Array.isArray(comps) ? comps : (comps?.data || []);
      const validGrps = Array.isArray(grps) && grps.length > 0 ? grps : DEFAULT_PRODUCT_TYPES;
      const validUnits = Array.isArray(units) ? units : (units?.data || []);
      const validVends = Array.isArray(vends) ? vends : (vends?.data || []);

      setCompanies(validComps);
      setProductGroups(validGrps);
      setAvailableUnits(validUnits);
      setVendors(validVends);

      if (!isEdit) {
        // Set smart defaults
        const defaultUnit = validUnits.find(u => u.unitCode === 'PCS' || u.unitName?.toLowerCase().includes('piece')) || validUnits[0];
        const defaultComp = validComps.find(c => c.companyName?.toUpperCase() === 'ROCA') || validComps[0];
        
        setFormData(prev => ({
          ...prev,
          unitId: defaultUnit?._id || defaultUnit?.id || '',
          unit: defaultUnit?.unitName || 'Pcs',
          companyId: defaultComp?._id || defaultComp?.id || '',
          company: defaultComp?.companyName || 'ROCA'
        }));
      }
    });
  }, []);

  // Load product if editing
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    getProductById(id)
      .then(res => {
        const p = res.data || res;
        if (!p) return;

        const cat = p.category || (p.productGroup?.category) || 'Sanitaryware';
        const isTile = cat === 'Tiles';

        setFormData({
          productName: p.productName || '',
          company: p.company?.companyName || p.company || '',
          companyId: p.company?._id || p.company?.id || (typeof p.company === 'string' ? p.company : ''),
          vendor: p.vendor?.vendorName || p.vendor || '',
          vendorId: p.vendor?._id || p.vendor?.id || (typeof p.vendor === 'string' ? p.vendor : ''),
          category: cat,
          productGroup: p.productGroup?.groupName || p.productGroup || p.productType || '',
          productGroupId: p.productGroup?._id || p.productGroup?.id || '',
          productType: p.productType || p.productGroup?.groupName || '',
          productSubType: p.productSubType || '',
          rangeOrSize: p.rangeOrSize || (isTile ? p.size : p.range) || '',
          range: p.range || '',
          size: p.size || '',
          colourName: p.colourName || p.color || 'White',
          finish: p.finish || 'Glossy',
          fullDescription: p.fullDescription || p.description || '',
          piecesPerBox: p.piecesPerBox || '',
          sqftPerBox: p.sqftPerBox || '',
          weightPerBox: p.weightPerBox || '',
          hsnCode: p.hsnCode || (isTile ? '69072100' : '69109000'),
          sku: p.companySkuCode || p.sku || '',
          vendorSku: p.vendorSkuCode || '',
          companySku: p.companySkuCode || '',
          unit: p.unit?.unitName || '',
          unitId: p.unit?._id || p.unit?.id || '',
          image: p.productImage || '',
          gstPercent: p.gstPct || 18,
          igstPercent: p.igstPct || 18,
          cgstPercent: p.cgstPct || 9,
          sgstPercent: p.sgstPct || 9,
          cessPercent: p.cessPct || 0,
          mrp: p.mrp || '',
          purchaseRate: p.purchaseRate || '',
          costRate: p.costRate || '',
          salePrice: p.salePrice || '',
          saleDiscount: p.saleDiscount || 0,
          openingStock: p.openingStock || 0,
          openingStockValue: p.openingStockValue || 0,
          defaultQty: p.defaultQuantity || 1,
          reorderLevel: p.reorderAlertQty || 10,
          alertStockQty: p.reorderAlertQty || 10,
          status: p.isActive !== false ? 'Active' : 'Inactive'
        });
        setIsSkuManuallyEdited(true);
      })
      .catch(err => {
        console.error('Error fetching product:', err);
        setFormErrorSummary('Failed to load product details.');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const isTileCategory = formData.category === 'Tiles';

  // Available SubTypes for the currently selected Product Type
  const currentSubTypes = React.useMemo(() => {
    if (!formData.productType) return [];
    const matchedType = productGroups.find(
      g => (g.groupName || g.typeName || '').toLowerCase() === formData.productType.toLowerCase()
    );
    return matchedType && Array.isArray(matchedType.subTypes) ? matchedType.subTypes : [];
  }, [formData.productType, productGroups]);

  // Handle Category Change (updates default HSN & unit automatically)
  const handleCategoryChange = (newCat) => {
    let newHsn = formData.hsnCode;
    if (newCat === 'Tiles') {
      newHsn = '69072100';
    } else if (newCat === 'Sanitaryware') {
      newHsn = '69109000';
    } else if (newCat === 'Faucets' || newCat === 'Showers' || newCat === 'Allied') {
      newHsn = '84818020';
    }

    setFormData(prev => ({
      ...prev,
      category: newCat,
      hsnCode: newHsn,
      productType: '',
      productSubType: ''
    }));
  };

  // Quick Create Company
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!companyFormData.companyName.trim()) {
      setCompanyFormError('Company Name is required.');
      return;
    }
    setSavingCompany(true);
    setCompanyFormError('');
    try {
      const res = await createCompany(companyFormData);
      const newComp = res.data || res;
      setCompanies(prev => [...prev, newComp]);
      setFormData(prev => ({
        ...prev,
        companyId: newComp._id || newComp.id,
        company: newComp.companyName
      }));
      setShowCompanyModal(false);
      setCompanyFormData({ companyName: '', code: '', isOwnCompany: false, status: 'Active' });
    } catch (err) {
      setCompanyFormError(err.response?.data?.message || 'Failed to create company.');
    } finally {
      setSavingCompany(false);
    }
  };

  // Quick Create Product Type
  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!typeFormData.groupName.trim()) {
      setTypeFormError('Product Type Name is required.');
      return;
    }
    setSavingType(true);
    setTypeFormError('');
    try {
      const res = await createProductGroup({
        groupName: typeFormData.groupName.trim(),
        category: typeFormData.category,
        subTypes: typeFormData.subTypes,
        description: typeFormData.description,
        isActive: typeFormData.status === 'Active'
      });
      const newType = res.data || res;
      setProductGroups(prev => [...prev, newType]);
      setFormData(prev => ({
        ...prev,
        productGroupId: newType._id || newType.id,
        productType: newType.groupName,
        category: newType.category || prev.category
      }));
      setShowTypeModal(false);
      setTypeFormData({ groupName: '', category: 'Sanitaryware', subTypes: [], subTypeInput: '', description: '', status: 'Active' });
    } catch (err) {
      setTypeFormError(err.response?.data?.message || 'Failed to create Product Type.');
    } finally {
      setSavingType(false);
    }
  };

  // Image Upload handler
  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrorSummary('');

    if (!formData.productName.trim()) {
      setFormErrorSummary('Product Name is required.');
      return;
    }
    if (!formData.sku.trim()) {
      setFormErrorSummary('Product SKU / Code is required.');
      return;
    }
    if (!formData.unitId) {
      setFormErrorSummary('Please select a Unit of Measurement.');
      return;
    }

    setSaving(true);
    try {
      const rangeOrSizeVal = isTileCategory ? (formData.size || formData.rangeOrSize) : (formData.range || formData.rangeOrSize);

      const payload = {
        companySkuCode: formData.sku.trim(),
        vendorSkuCode: formData.vendorSku?.trim() || null,
        productName: formData.productName.trim(),
        hsnCode: formData.hsnCode?.trim() || null,
        company: formData.companyId || null,
        vendor: formData.vendorId || null,
        productGroup: formData.productGroupId || null,
        category: formData.category,
        productType: formData.productType || null,
        productSubType: formData.productSubType || null,
        rangeOrSize: rangeOrSizeVal || null,
        range: isTileCategory ? null : (formData.range || rangeOrSizeVal || null),
        size: isTileCategory ? (formData.size || rangeOrSizeVal || null) : null,
        colourName: formData.colourName?.trim() || null,
        finish: formData.finish?.trim() || null,
        fullDescription: formData.fullDescription?.trim() || null,
        piecesPerBox: isTileCategory && formData.piecesPerBox ? Number(formData.piecesPerBox) : null,
        sqftPerBox: isTileCategory && formData.sqftPerBox ? Number(formData.sqftPerBox) : null,
        weightPerBox: isTileCategory && formData.weightPerBox ? Number(formData.weightPerBox) : null,
        productImage: formData.image || null,
        unit: formData.unitId,
        gstPct: Number(formData.gstPercent) || 0,
        igstPct: Number(formData.igstPercent) || 0,
        cgstPct: Number(formData.cgstPercent) || 0,
        sgstPct: Number(formData.sgstPercent) || 0,
        mrp: Number(formData.mrp) || 0,
        purchaseRate: Number(formData.purchaseRate) || 0,
        costRate: Number(formData.costRate || formData.purchaseRate) || 0,
        salePrice: Number(formData.salePrice) || 0,
        saleDiscount: Number(formData.saleDiscount) || 0,
        openingStock: Number(formData.openingStock) || 0,
        reorderAlertQty: Number(formData.reorderLevel || formData.alertStockQty) || 10,
        isActive: formData.status === 'Active'
      };

      if (isEdit) {
        await updateProduct(id, payload);
        setSuccessToast(`Product "${payload.productName}" updated successfully!`);
      } else {
        await createProduct(payload);
        setSuccessToast(`Product "${payload.productName}" created successfully!`);
      }

      setTimeout(() => {
        navigate('/products');
      }, 1500);
    } catch (err) {
      console.error('Save product error:', err);
      setFormErrorSummary(err.response?.data?.message || err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
        <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>Loading product information...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '3.5rem' }}>
      {/* Toast Notification */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn btn-secondary"
            style={{ borderRadius: '8px', padding: '0.45rem 0.8rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to Products</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {isEdit ? 'Edit Product & Specifications' : 'Add New Product'}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              Standardized Ceramic & Sanitaryware Product Entry according to Roca Portfolio Catalog.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="btn btn-primary"
          style={{ borderRadius: '9px', padding: '0.55rem 1.4rem', fontWeight: 700, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : isEdit ? 'Update Product' : 'Save Product'}</span>
        </button>
      </div>

      {formErrorSummary && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.85rem 1.25rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} />
          <span>{formErrorSummary}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          
          {/* Section 1: Product Identification & Classification */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem', paddingBottom: '0.65rem', borderBottom: '1px solid #f1f5f9' }}>
              <Package size={18} style={{ color: '#2563eb' }} />
              1. Product Identification & Category
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Category Radio Buttons */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Product Category <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.35rem' }}>
                  {CATEGORIES.map(cat => {
                    const isSelected = formData.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        style={{
                          backgroundColor: isSelected ? '#2563eb' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#334155',
                          border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '0.35rem 0.8rem',
                          fontSize: '0.8rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SKU & Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    SKU / Code <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. RS893020001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700 }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Product Title / Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. W+W Wall Hung Water Closet and Basin Unit"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
                    required
                  />
                </div>
              </div>

              {/* Company / Brand */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem', margin: 0 }}>
                    Company / Brand <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCompanyModal(true)}
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    + Quick Add Brand
                  </button>
                </div>
                <select
                  className="form-control"
                  value={formData.companyId}
                  onChange={(e) => {
                    const c = companies.find(comp => (comp._id || comp.id) === e.target.value);
                    setFormData({ ...formData, companyId: e.target.value, company: c?.companyName || '' });
                  }}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <option value="">Select Brand / Company</option>
                  {companies.map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Type & Product SubType */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem', margin: 0 }}>
                      Product Type
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowTypeModal(true)}
                      style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      + Add Type
                    </button>
                  </div>
                  <select
                    className="form-control"
                    value={formData.productType}
                    onChange={(e) => {
                      const pt = productGroups.find(g => (g.groupName || g.typeName) === e.target.value);
                      setFormData({
                        ...formData,
                        productType: e.target.value,
                        productGroupId: pt?._id || pt?.id || '',
                        productGroup: pt?.groupName || e.target.value,
                        productSubType: ''
                      });
                    }}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="">Select Type</option>
                    {productGroups
                      .filter(g => !formData.category || (g.category || 'Sanitaryware') === formData.category)
                      .map((g, idx) => (
                        <option key={g._id || g.id || idx} value={g.groupName || g.typeName}>
                          {g.groupName || g.typeName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Product SubType
                  </label>
                  {currentSubTypes.length > 0 ? (
                    <select
                      className="form-control"
                      value={formData.productSubType}
                      onChange={(e) => setFormData({ ...formData, productSubType: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      <option value="">Select SubType</option>
                      {currentSubTypes.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Wall Hung WC / GVT"
                      value={formData.productSubType}
                      onChange={(e) => setFormData({ ...formData, productSubType: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                  )}
                </div>
              </div>

              {/* Dynamic Field: Range vs Size (as specifically requested) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '9px', border: '1px solid #e2e8f0' }}>
                {isTileCategory ? (
                  /* Tile Size & Dimensions */
                  <div>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: '0.825rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Ruler size={16} style={{ color: '#2563eb' }} />
                      Tile Size / Dimensions <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 600x1200 mm, 800x1600 mm"
                      value={formData.size || formData.rangeOrSize}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value, rangeOrSize: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                    />
                    {/* Quick Size Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {TILE_SIZE_PRESETS.map((sz, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, size: sz, rangeOrSize: sz })}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: (formData.size === sz || formData.rangeOrSize === sz) ? '#eff6ff' : '#ffffff',
                            color: (formData.size === sz || formData.rangeOrSize === sz) ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Sanitaryware / Faucets Range & Collection */
                  <div>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: '0.825rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Tag size={16} style={{ color: '#2563eb' }} />
                      Range / Collection Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. MERIDIAN, INSIGNIA, W+W, THE GAP, ONA"
                      value={formData.range || formData.rangeOrSize}
                      onChange={(e) => setFormData({ ...formData, range: e.target.value, rangeOrSize: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                    />
                    {/* Quick Range Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {SANITARY_RANGE_PRESETS.map((rg, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFormData({ ...formData, range: rg, rangeOrSize: rg })}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: (formData.range === rg || formData.rangeOrSize === rg) ? '#eff6ff' : '#ffffff',
                            color: (formData.range === rg || formData.rangeOrSize === rg) ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {rg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Color, Finish, Specifications & Packaging */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem', paddingBottom: '0.65rem', borderBottom: '1px solid #f1f5f9' }}>
              <Palette size={18} style={{ color: '#0d9488' }} />
              2. Design, Color & Technical Details
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Color Name & Surface Finish */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Colour / Finish Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. White, Glossy White, Matte Black, Chrome"
                    value={formData.colourName}
                    onChange={(e) => setFormData({ ...formData, colourName: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Surface Texture
                  </label>
                  <select
                    className="form-control"
                    value={formData.finish}
                    onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value="Glossy">Glossy / Mirror Polish</option>
                    <option value="Satin Matte">Satin Matte</option>
                    <option value="High Gloss Vitrified">High Gloss Vitrified</option>
                    <option value="Rustic / Textured">Rustic / Textured</option>
                    <option value="Chrome Plated">Chrome Plated</option>
                    <option value="PVD Rose Gold">PVD Rose Gold</option>
                    <option value="PVD Matte Black">PVD Matte Black</option>
                  </select>
                </div>
              </div>

              {/* HSN Code & Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    HSN Code <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="69109000 / 69072100"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Unit of Measurement <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={formData.unitId}
                    onChange={(e) => {
                      const u = availableUnits.find(unit => (unit._id || unit.id) === e.target.value);
                      setFormData({ ...formData, unitId: e.target.value, unit: u?.unitName || '' });
                    }}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  >
                    <option value="">Select Unit</option>
                    {availableUnits.map(u => (
                      <option key={u._id || u.id} value={u._id || u.id}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tile Packaging (Shown for Tiles) */}
              {isTileCategory && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '9px', padding: '0.85rem' }}>
                  <label className="form-label" style={{ fontWeight: 800, fontSize: '0.825rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    <Box size={16} style={{ color: '#16a34a' }} />
                    Tile Box Packaging & Coverage Specifications
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Pcs / Box</span>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 2"
                        value={formData.piecesPerBox}
                        onChange={(e) => setFormData({ ...formData, piecesPerBox: e.target.value })}
                        style={{ height: '34px', borderRadius: '6px', fontSize: '0.8rem', marginTop: '0.2rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Sq.Ft / Box</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="e.g. 15.5"
                        value={formData.sqftPerBox}
                        onChange={(e) => setFormData({ ...formData, sqftPerBox: e.target.value })}
                        style={{ height: '34px', borderRadius: '6px', fontSize: '0.8rem', marginTop: '0.2rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Weight (Kg)</span>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        placeholder="e.g. 28"
                        value={formData.weightPerBox}
                        onChange={(e) => setFormData({ ...formData, weightPerBox: e.target.value })}
                        style={{ height: '34px', borderRadius: '6px', fontSize: '0.8rem', marginTop: '0.2rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Full Technical Description */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Full Description (As printed on Quotation / Invoices)
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="e.g. Single Unit of Wall Hung Water Closet and Wash Basin with UF Soft Close Seat Cover, Fixing Accessories, Size: 860x500x760 mm, White"
                  value={formData.fullDescription}
                  onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                  style={{ borderRadius: '8px', fontSize: '0.825rem' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing, GST & Taxes */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem', paddingBottom: '0.65rem', borderBottom: '1px solid #f1f5f9' }}>
              <DollarSign size={18} style={{ color: '#16a34a' }} />
              3. Pricing, GST & Margins
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Catalog MRP (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Selling Price / Wholesale (₹) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Purchase Rate / Cost (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={formData.purchaseRate}
                  onChange={(e) => setFormData({ ...formData, purchaseRate: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  GST Tax Rate %
                </label>
                <select
                  className="form-control"
                  value={formData.gstPercent}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    setFormData({
                      ...formData,
                      gstPercent: g,
                      igstPercent: g,
                      cgstPercent: g / 2,
                      sgstPercent: g / 2
                    });
                  }}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <option value={18}>18% Standard Ceramic GST (9% CGST + 9% SGST)</option>
                  <option value={12}>12% GST</option>
                  <option value={28}>28% Luxury GST</option>
                  <option value={5}>5% Low GST</option>
                  <option value={0}>0% Nil GST</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Inventory, Stock & Low Stock Alert Level */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem', paddingBottom: '0.65rem', borderBottom: '1px solid #f1f5f9' }}>
              <Layers size={18} style={{ color: '#ea580c' }} />
              4. Inventory & Reorder Thresholds
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Opening Stock Quantity
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0"
                  value={formData.openingStock}
                  onChange={(e) => setFormData({ ...formData, openingStock: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Low Stock Alert Level (Threshold)
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="10"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value, alertStockQty: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem', borderColor: '#fed7aa' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Product Active Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <option value="Active">Active (Available for Quotations & Invoicing)</option>
                  <option value="Inactive">Inactive (Hidden from catalog)</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem', marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn btn-secondary"
            style={{ borderRadius: '9px', padding: '0.65rem 1.4rem', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ borderRadius: '9px', padding: '0.65rem 1.8rem', fontWeight: 700, fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : isEdit ? 'Update Product' : 'Save Product'}</span>
          </button>
        </div>
      </form>

      {/* Quick Brand Modal */}
      {showCompanyModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Add New Brand / Company</h3>
              <button type="button" onClick={() => setShowCompanyModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {companyFormError && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{companyFormError}</div>}
            <form onSubmit={handleCreateCompany}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>Brand / Company Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. ROCA, Kajaria, Somany"
                  value={companyFormData.companyName}
                  onChange={(e) => setCompanyFormData({ ...companyFormData, companyName: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowCompanyModal(false)} className="btn btn-secondary btn-sm" style={{ borderRadius: '6px' }}>Cancel</button>
                <button type="submit" disabled={savingCompany} className="btn btn-primary btn-sm" style={{ borderRadius: '6px', fontWeight: 700 }}>
                  {savingCompany ? 'Saving...' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Type Modal */}
      {showTypeModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '460px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Add New Product Type</h3>
              <button type="button" onClick={() => setShowTypeModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {typeFormError && <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{typeFormError}</div>}
            <form onSubmit={handleCreateType}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>Category</label>
                <select
                  className="form-control"
                  value={typeFormData.category}
                  onChange={(e) => setTypeFormData({ ...typeFormData, category: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>Product Type Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Water Closet, Wall Tiles, Shower Column"
                  value={typeFormData.groupName}
                  onChange={(e) => setTypeFormData({ ...typeFormData, groupName: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setShowTypeModal(false)} className="btn btn-secondary btn-sm" style={{ borderRadius: '6px' }}>Cancel</button>
                <button type="submit" disabled={savingType} className="btn btn-primary btn-sm" style={{ borderRadius: '6px', fontWeight: 700 }}>
                  {savingType ? 'Saving...' : 'Create Type'}
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
