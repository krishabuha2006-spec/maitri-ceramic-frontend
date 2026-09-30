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
  getVendors, createVendor,
  uploadProductImage
} from '../services/productService';
import { getUnits } from '../services/masterService';
import { getCategories } from '../services/categoryService';
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

/**
 * Auto-composes clean standard tile titles from brand, type, dimensions and finish
 */
export const generateTileTitle = ({ company, productType, productSubType, size, rangeOrSize, finish, colourName }) => {
  const parts = [];
  
  if (company && typeof company === 'string' && company.trim()) {
    parts.push(company.trim());
  }
  
  const subTypeClean = (productSubType || '').trim();
  const typeClean = (productType || '').trim();
  if (subTypeClean && subTypeClean.toLowerCase() !== 'general') {
    parts.push(subTypeClean);
  } else if (typeClean && typeClean.toLowerCase() !== 'general') {
    parts.push(typeClean);
  }
  
  const sizeVal = (size || rangeOrSize || '').trim();
  if (sizeVal) {
    parts.push(sizeVal);
  }
  
  const finishVal = (finish || '').trim();
  if (finishVal && finishVal.toLowerCase() !== 'standard') {
    parts.push(finishVal);
  }
  
  const colorVal = (colourName || '').trim();
  if (colorVal && colorVal.toLowerCase() !== 'standard' && colorVal.toLowerCase() !== 'white') {
    parts.push(colorVal);
  } else if (colorVal && colorVal.toLowerCase() === 'white' && parts.length <= 2) {
    parts.push(colorVal);
  }

  const nameString = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!nameString) return 'Ceramic Tile';
  if (!nameString.toLowerCase().includes('tile')) {
    return `${nameString} Tile`;
  }
  return nameString;
};

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
  const [uploadingImage, setUploadingImage] = useState(false);
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

  const [categoriesList, setCategoriesList] = useState(CATEGORIES);

  // Load masters & edit product
  useEffect(() => {
    Promise.all([
      getCompanies().catch(() => []),
      getProductGroups().catch(() => []),
      getUnits().catch(() => []),
      getVendors().catch(() => []),
      getCategories().catch(() => [])
    ]).then(([comps, grps, units, vends, cats]) => {
      const validComps = Array.isArray(comps) ? comps : (comps?.data || []);
      const dbGrps = Array.isArray(grps) ? grps : (grps?.data || []);
      
      // Combine DB Product Groups with standard presets, eliminating duplicates & general
      const mergedGrpsMap = new Map();
      DEFAULT_PRODUCT_TYPES.forEach(item => {
        mergedGrpsMap.set(item.groupName.toLowerCase().trim(), item);
      });
      dbGrps.forEach(item => {
        const name = (item.groupName || item.typeName || '').toLowerCase().trim();
        if (name && name !== 'general') {
          mergedGrpsMap.set(name, item);
        }
      });
      const validGrps = Array.from(mergedGrpsMap.values());

      const validUnits = Array.isArray(units) ? units : (units?.data || []);
      const validVends = Array.isArray(vends) ? vends : (vends?.data || []);
      const validCats = Array.isArray(cats) && cats.length > 0 ? cats.map(c => c.categoryName).filter(Boolean) : CATEGORIES;

      setCompanies(validComps);
      setProductGroups(validGrps);
      setAvailableUnits(validUnits);
      setVendors(validVends);
      setCategoriesList(validCats);

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
    if (!isEdit || !id) return;
    setLoading(true);
    getProductById(id)
      .then(res => {
        const p = res?.data?.product || res?.data || res;
        if (!p) return;

        const cat = p.category || (p.productGroup?.category) || 'Sanitaryware';
        const isTile = cat === 'Tiles';

        const cId = p.company?._id || p.company?.id || (typeof p.company === 'string' && p.company.length === 24 ? p.company : p.companyId || '');
        const uId = p.unit?._id || p.unit?.id || (typeof p.unit === 'string' && p.unit.length === 24 ? p.unit : p.unitId || '');
        const grpId = p.productGroup?._id || p.productGroup?.id || (typeof p.productGroup === 'string' && p.productGroup.length === 24 ? p.productGroup : p.productGroupId || '');
        const vId = p.vendor?._id || p.vendor?.id || (typeof p.vendor === 'string' && p.vendor.length === 24 ? p.vendor : p.vendorId || '');

        const rawType = p.productType || (p.productGroup?.groupName && p.productGroup.groupName.toLowerCase() !== 'general' ? p.productGroup.groupName : '') || '';
        const cleanProductType = rawType.toLowerCase() === 'general' ? '' : rawType;

        setFormData({
          productName: p.productName || p.name || '',
          company: p.company?.companyName || p.companyName || (typeof p.company === 'string' && p.company.length !== 24 ? p.company : ''),
          companyId: cId,
          vendor: p.vendor?.vendorName || p.vendorName || (typeof p.vendor === 'string' && p.vendor.length !== 24 ? p.vendor : ''),
          vendorId: vId,
          category: cat,
          productGroup: cleanProductType,
          productGroupId: grpId,
          productType: cleanProductType,
          productSubType: p.productSubType || '',
          rangeOrSize: p.rangeOrSize || (isTile ? p.size : p.range) || '',
          range: p.range || (isTile ? '' : (p.rangeOrSize || '')),
          size: p.size || (isTile ? (p.rangeOrSize || '') : ''),
          colourName: p.colourName || p.color || 'White',
          finish: p.finish || 'Glossy',
          fullDescription: p.fullDescription || p.description || '',
          piecesPerBox: p.piecesPerBox !== undefined && p.piecesPerBox !== null ? p.piecesPerBox : '',
          sqftPerBox: p.sqftPerBox !== undefined && p.sqftPerBox !== null ? p.sqftPerBox : '',
          weightPerBox: weightPerBoxValue(p),
          hsnCode: p.hsnCode || (isTile ? '69072100' : '69109000'),
          sku: p.companySkuCode || p.sku || '',
          vendorSku: p.vendorSkuCode || p.vendorSku || '',
          companySku: p.companySkuCode || p.companySku || '',
          unit: p.unit?.unitName || p.unit?.unitCode || (typeof p.unit === 'string' && p.unit.length !== 24 ? p.unit : 'PCS'),
          unitId: uId,
          image: p.productImage || p.image || '',
          gstPercent: Number(p.gstPct !== undefined ? p.gstPct : (p.gstPercent || 18)),
          igstPercent: Number(p.igstPct !== undefined ? p.igstPct : (p.gstPct || p.gstPercent || 18)),
          cgstPercent: Number(p.cgstPct !== undefined ? p.cgstPct : (p.gstPct || 18) / 2),
          sgstPercent: Number(p.sgstPct !== undefined ? p.sgstPct : (p.gstPct || 18) / 2),
          cessPercent: Number(p.cessPct || 0),
          mrp: p.mrp !== undefined && p.mrp !== null ? p.mrp : '',
          purchaseRate: p.purchaseRate !== undefined && p.purchaseRate !== null ? p.purchaseRate : '',
          costRate: p.costRate !== undefined && p.costRate !== null ? p.costRate : (p.purchaseRate || ''),
          salePrice: p.salePrice !== undefined && p.salePrice !== null ? p.salePrice : '',
          saleDiscount: p.saleDiscount !== undefined && p.saleDiscount !== null ? p.saleDiscount : 0,
          openingStock: p.openingStock !== undefined ? p.openingStock : 0,
          openingStockValue: p.openingStockValue !== undefined ? p.openingStockValue : 0,
          defaultQty: p.defaultQuantity || 1,
          reorderLevel: p.reorderAlertQty !== undefined ? p.reorderAlertQty : (p.reorderLevel || 10),
          alertStockQty: p.reorderAlertQty !== undefined ? p.reorderAlertQty : (p.alertStockQty || 10),
          status: p.isActive !== false && p.status !== 'Inactive' ? 'Active' : 'Inactive'
        });
        setIsSkuManuallyEdited(true);
      })
      .catch(err => {
        console.error('Error fetching product:', err);
        setFormErrorSummary('Failed to load product details.');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function weightPerBoxValue(p) {
    if (p.weightPerBox !== undefined && p.weightPerBox !== null) return p.weightPerBox;
    return '';
  }

  const isTileCategory = formData.category === 'Tiles';

  // Live auto-composed title for Tiles based on specifications
  const generatedTileTitle = React.useMemo(() => {
    return generateTileTitle({
      company: formData.company,
      productType: formData.productType,
      productSubType: formData.productSubType,
      size: formData.size || formData.rangeOrSize,
      finish: formData.finish,
      colourName: formData.colourName
    });
  }, [formData.company, formData.productType, formData.productSubType, formData.size, formData.rangeOrSize, formData.finish, formData.colourName]);

  // Filter product types matching category, while preserving currently selected productType
  const filteredProductTypes = React.useMemo(() => {
    const activeCat = (formData.category || '').toLowerCase().trim();
    const list = productGroups.filter(g => {
      const gCat = (g.category || '').toLowerCase().trim();
      const gName = (g.groupName || g.typeName || '').toLowerCase().trim();
      if (gName === 'general') return false;
      return !activeCat || gCat === activeCat;
    });

    if (formData.productType && formData.productType.toLowerCase().trim() !== 'general' && !list.some(g => (g.groupName || g.typeName || '').trim().toLowerCase() === formData.productType.trim().toLowerCase())) {
      return [{ _id: 'current-selected-type', groupName: formData.productType, subTypes: [] }, ...list];
    }
    return list;
  }, [formData.category, formData.productType, productGroups]);

  // Available SubTypes for the currently selected Product Type
  const currentSubTypes = React.useMemo(() => {
    if (!formData.productType || formData.productType.toLowerCase().trim() === 'general') return [];
    const pTypeClean = formData.productType.trim().toLowerCase();
    const matchedType = productGroups.find(
      g => (g.groupName || g.typeName || '').trim().toLowerCase() === pTypeClean
    );
    const subs = matchedType && Array.isArray(matchedType.subTypes) ? matchedType.subTypes : [];

    if (formData.productSubType && !subs.some(s => s.trim().toLowerCase() === formData.productSubType.trim().toLowerCase())) {
      return [formData.productSubType, ...subs];
    }
    return subs;
  }, [formData.productType, formData.productSubType, productGroups]);

  // Handle Product Type change & auto-match productGroupId
  const handleProductTypeChange = (typeName) => {
    const matched = productGroups.find(
      g => (g.groupName || g.typeName || '').trim().toLowerCase() === typeName.trim().toLowerCase()
    );
    const subs = matched && Array.isArray(matched.subTypes) ? matched.subTypes : [];
    setFormData(prev => ({
      ...prev,
      productType: typeName,
      productGroupId: matched?._id || matched?.id || '',
      productGroup: matched?.groupName || typeName,
      productSubType: subs.length > 0 ? (subs.includes(prev.productSubType) ? prev.productSubType : subs[0]) : ''
    }));
  };

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
      productSubType: '',
      productGroupId: '',
      productGroup: ''
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

  // Image Upload handler with Cloudinary upload & canvas fallback
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFormErrorSummary('Selected image file exceeds 10MB limit.');
      return;
    }

    setUploadingImage(true);
    setFormErrorSummary('');

    // 1. Instant local preview for immediate visual feedback
    const reader = new FileReader();
    reader.onload = (event) => {
      const localPreviewUrl = event.target.result;
      setFormData(prev => ({ ...prev, image: localPreviewUrl }));
    };
    reader.readAsDataURL(file);

    // 2. Upload to backend Cloudinary service
    try {
      const uploadRes = await uploadProductImage(file);
      if (uploadRes && uploadRes.url) {
        setFormData(prev => ({ ...prev, image: uploadRes.url }));
      }
    } catch (uploadErr) {
      console.warn('Cloudinary upload error, using optimized local base64 fallback:', uploadErr);
      // Client-side canvas compression fallback
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 900;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setFormData(prev => ({ ...prev, image: compressedDataUrl }));
        };
        img.src = URL.createObjectURL(file);
      } catch (fallbackErr) {
        console.error('Fallback compression error:', fallbackErr);
      }
    } finally {
      setUploadingImage(false);
      // Reset input value so same file can be re-selected if needed
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrorSummary('');

    const trimmedName = isTileCategory
      ? (generatedTileTitle || 'Ceramic Tile')
      : formData.productName?.trim();

    if (!trimmedName) {
      setFormErrorSummary('Please enter a Product Title / Name.');
      return;
    }

    setSaving(true);
    try {
      const rangeOrSizeVal = isTileCategory ? (formData.size || formData.rangeOrSize) : (formData.range || formData.rangeOrSize);

      let resolvedUnitId = formData.unitId;
      if (!resolvedUnitId && availableUnits.length > 0) {
        resolvedUnitId = availableUnits[0]._id || availableUnits[0].id;
      }

      const resolvedSku = formData.sku?.trim() || `SKU-${Date.now()}`;

      const payload = {
        companySkuCode: resolvedSku,
        vendorSkuCode: formData.vendorSku?.trim() || null,
        productName: trimmedName,
        hsnCode: formData.hsnCode?.trim() || (isTileCategory ? '69072100' : '69109000'),
        company: formData.companyId || (formData.company && typeof formData.company === 'string' ? formData.company.trim() : null),
        vendor: formData.vendorId || (formData.vendor && typeof formData.vendor === 'string' ? formData.vendor.trim() : null),
        productGroup: formData.productGroupId || formData.productGroup || formData.productType || null,
        category: formData.category || 'Sanitaryware',
        productType: formData.productType || null,
        productSubType: formData.productSubType || null,
        rangeOrSize: rangeOrSizeVal || null,
        range: isTileCategory ? null : (formData.range || rangeOrSizeVal || null),
        size: isTileCategory ? (formData.size || rangeOrSizeVal || null) : null,
        colourName: formData.colourName?.trim() || null,
        finish: formData.finish?.trim() || null,
        fullDescription: formData.fullDescription?.trim() || null,
        piecesPerBox: isTileCategory && formData.piecesPerBox !== '' && formData.piecesPerBox !== null ? Number(formData.piecesPerBox) : null,
        sqftPerBox: isTileCategory && formData.sqftPerBox !== '' && formData.sqftPerBox !== null ? Number(formData.sqftPerBox) : null,
        weightPerBox: isTileCategory && formData.weightPerBox !== '' && formData.weightPerBox !== null ? Number(formData.weightPerBox) : null,
        productImage: formData.image || null,
        unit: resolvedUnitId || (formData.unit && typeof formData.unit === 'string' ? formData.unit.trim() : 'PCS'),
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
        openingStockValue: Number(formData.openingStockValue) || 0,
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
      }, 1200);
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
      </div>

      {formErrorSummary && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.85rem 1.25rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertCircle size={18} />
          <span>{formErrorSummary}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Product Identification & Category */}
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
              borderRadius: '9px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Package size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                1. Product Identification & Category
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                Category, SKU, product title, brand, and type classification
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Category Dropdown */}
            <div className="form-group" style={{ gridColumn: isTileCategory ? 'span 6' : 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                Product Category <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                <option value="">Select Category</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* SKU / Code */}
            <div className="form-group" style={{ gridColumn: isTileCategory ? 'span 6' : 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                SKU / Code
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. RS893020001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700 }}
              />
            </div>

            {/* Product Title / Name - Only for Non-Tiles categories */}
            {!isTileCategory && (
              <div className="form-group" style={{ gridColumn: 'span 4' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  Product Title / Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. W+W Wall Hung Water Closet and Basin Unit"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600 }}
                />
              </div>
            )}

            {/* Company / Brand */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                  Company / Brand <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(true)}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.775rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
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
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                <option value="">Select Brand / Company</option>
                {companies.map(c => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Type */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                  {isTileCategory ? 'Tile Classification / Type' : 'Product Type'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowTypeModal(true)}
                  style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.775rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  + Add Type
                </button>
              </div>
              <select
                className="form-control"
                value={formData.productType}
                onChange={(e) => handleProductTypeChange(e.target.value)}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                <option value="">Select Type</option>
                {filteredProductTypes.map((g, idx) => {
                  const val = g.groupName || g.typeName;
                  return (
                    <option key={g._id || g.id || idx} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Product SubType */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                {isTileCategory ? 'Tile Body / SubType' : 'Product SubType'}
              </label>
              {currentSubTypes.length > 0 ? (
                <select
                  className="form-control"
                  value={formData.productSubType}
                  onChange={(e) => setFormData({ ...formData, productSubType: e.target.value })}
                  style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
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
                  placeholder={isTileCategory ? 'e.g. GVT, PGVT, Ceramic Body' : 'e.g. Wall Hung WC'}
                  value={formData.productSubType}
                  onChange={(e) => setFormData({ ...formData, productSubType: e.target.value })}
                  style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
                />
              )}
            </div>

            {/* Live Auto-Generated Title Banner for Tiles */}
            {isTileCategory && (
              <div style={{
                gridColumn: 'span 12',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Auto-Generated Tile Name / Title
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginTop: '0.1rem' }}>
                      {generatedTileTitle || 'Ceramic Tile'}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#ffffff', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  Auto Composed from Specs
                </span>
              </div>
            )}

            {/* Dynamic Field: Range vs Size */}
            <div style={{ gridColumn: 'span 12', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {isTileCategory ? (
                /* Tile Size & Dimensions */
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
                    <Ruler size={16} style={{ color: '#2563eb' }} />
                    Tile Size / Dimensions <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 600x1200 mm, 800x1600 mm"
                      value={formData.size || formData.rangeOrSize}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value, rangeOrSize: e.target.value })}
                      style={{ height: '44px', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                  {/* Quick Size Presets */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600, marginRight: '0.25rem' }}>Presets:</span>
                    {TILE_SIZE_PRESETS.map((sz, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, size: sz, rangeOrSize: sz })}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
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
                  <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
                    <Tag size={16} style={{ color: '#2563eb' }} />
                    Range / Collection Name
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. MERIDIAN, INSIGNIA, W+W, THE GAP, ONA"
                      value={formData.range || formData.rangeOrSize}
                      onChange={(e) => setFormData({ ...formData, range: e.target.value, rangeOrSize: e.target.value })}
                      style={{ height: '44px', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                  {/* Quick Range Presets */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.775rem', color: '#64748b', fontWeight: 600, marginRight: '0.25rem' }}>Presets:</span>
                    {SANITARY_RANGE_PRESETS.map((rg, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, range: rg, rangeOrSize: rg })}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
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

        {/* Section 2: Product Image & Visuals */}
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
              borderRadius: '9px',
              backgroundColor: '#fdf4ff',
              color: '#c026d3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <FileImage size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                2. Product Image & Visuals
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                Upload high-resolution ceramic tile/sanitaryware product image
              </p>
            </div>
          </div>

          {/* Always mounted hidden file input for reliability */}
          <input
            type="file"
            ref={fileInputRef}
            id="product-image-file-input"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
            onChange={handleImageFile}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 160px) 1fr', gap: '1.5rem', alignItems: 'center' }}>
            {/* Visual Preview Box */}
            <div 
              onClick={() => {
                if (!formData.image && !uploadingImage) {
                  fileInputRef.current?.click();
                }
              }}
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '12px',
                border: formData.image ? '1px solid #e2e8f0' : '2px dashed #cbd5e1',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                cursor: !formData.image ? 'pointer' : 'default'
              }}
            >
              {uploadingImage ? (
                <div style={{ textAlign: 'center', color: '#2563eb', padding: '0.5rem' }}>
                  <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.4rem auto', display: 'block' }} />
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, display: 'block' }}>Uploading to Cloudinary...</span>
                </div>
              ) : formData.image ? (
                <>
                  <img
                    src={formData.image}
                    alt="Product Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setFormData(prev => ({ ...prev, image: '' }));
                    }}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      backgroundColor: 'rgba(220, 38, 38, 0.9)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      zIndex: 5
                    }}
                    title="Remove Image"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '0.5rem' }}>
                  <FileImage size={38} style={{ margin: '0 auto 0.4rem auto', opacity: 0.6 }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>Click to Choose</span>
                  <span style={{ fontSize: '0.65rem', color: '#cbd5e1', display: 'block' }}>PNG, JPG, WEBP</span>
                </div>
              )}
            </div>

            {/* Direct Choose/Upload Controls */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="btn btn-secondary"
                  style={{
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: '#eff6ff',
                    borderColor: '#bfdbfe',
                    color: '#1d4ed8',
                    cursor: 'pointer'
                  }}
                >
                  {uploadingImage ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={16} />}
                  <span>{uploadingImage ? 'Uploading Image...' : formData.image ? 'Replace Image' : 'Choose Image'}</span>
                </button>
                <span style={{ fontSize: '0.775rem', color: '#64748b' }}>
                  Supports PNG, JPG, JPEG, WEBP (Max 10MB)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Design, Color & Technical Details */}
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
              borderRadius: '9px',
              backgroundColor: '#f0fdfa',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Palette size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                3. Design, Color & Technical Details
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                Color finishes, surface textures, HSN codes, and item descriptions
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Colour / Finish Name */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Colour / Finish Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. White, Glossy White, Matte Black, Chrome"
                value={formData.colourName}
                onChange={(e) => setFormData({ ...formData, colourName: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              />
            </div>

            {/* Surface Texture */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Surface Texture
              </label>
              <select
                className="form-control"
                value={formData.finish}
                onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
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

            {/* HSN Code */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                HSN Code
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 69109000 / 69072100"
                value={formData.hsnCode}
                onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem', fontFamily: 'monospace', fontWeight: 600 }}
              />
            </div>

            {/* Unit of Measurement */}
            <div className="form-group" style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Unit of Measurement
              </label>
              <select
                className="form-control"
                value={formData.unitId}
                onChange={(e) => {
                  const u = availableUnits.find(unit => (unit._id || unit.id) === e.target.value);
                  setFormData({ ...formData, unitId: e.target.value, unit: u?.unitName || '' });
                }}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                <option value="">Select Unit</option>
                {availableUnits.map(u => (
                  <option key={u._id || u.id} value={u._id || u.id}>
                    {u.unitName} ({u.unitCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Tile Packaging (Shown for Tiles) */}
            {isTileCategory && (
              <div style={{ gridColumn: 'span 12', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1.25rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                  <Box size={16} style={{ color: '#16a34a' }} />
                  Tile Box Packaging & Coverage Specifications
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Pieces / Box</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 2"
                      value={formData.piecesPerBox}
                      onChange={(e) => setFormData({ ...formData, piecesPerBox: e.target.value })}
                      style={{ height: '42px', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Sq.Ft / Box</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 15.5"
                      value={formData.sqftPerBox}
                      onChange={(e) => setFormData({ ...formData, sqftPerBox: e.target.value })}
                      style={{ height: '42px', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Weight (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      placeholder="e.g. 28"
                      value={formData.weightPerBox}
                      onChange={(e) => setFormData({ ...formData, weightPerBox: e.target.value })}
                      style={{ height: '42px', borderRadius: '8px', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Full Technical Description */}
            <div className="form-group" style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Full Description (As printed on Quotation / Invoices)
              </label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="e.g. Single Unit of Wall Hung Water Closet and Wash Basin with UF Soft Close Seat Cover, Fixing Accessories, Size: 860x500x760 mm, White"
                value={formData.fullDescription}
                onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                style={{ borderRadius: '10px', fontSize: '0.875rem', padding: '0.75rem' }}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Pricing, GST & Taxes */}
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
              borderRadius: '9px',
              backgroundColor: '#ecfdf5',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                4. Pricing, GST & Margins
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                Catalog MRP, selling rates, purchase costs, and tax breakdown
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Catalog MRP */}
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Catalog MRP (₹)
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="0.00"
                value={formData.mrp}
                onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600 }}
              />
            </div>

            {/* Selling Price */}
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Selling Price / Wholesale (₹) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="0.00"
                value={formData.salePrice}
                onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 800, color: '#15803d' }}
              />
            </div>

            {/* Purchase Rate */}
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Purchase Rate / Cost (₹)
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="0.00"
                value={formData.purchaseRate}
                onChange={(e) => setFormData({ ...formData, purchaseRate: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.9rem' }}
              />
            </div>

            {/* GST Tax Rate */}
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
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
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                <option value={18}>18% Standard Ceramic (9%+9%)</option>
                <option value={12}>12% GST</option>
                <option value={28}>28% Luxury GST</option>
                <option value={5}>5% Low GST</option>
                <option value={0}>0% Nil GST</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 5: Inventory, Stock & Reorder Thresholds */}
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
              borderRadius: '9px',
              backgroundColor: '#fffbeb',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Layers size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                5. Inventory & Reorder Thresholds
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
                Stock levels, warehouse quantities, and active catalog status
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Opening Stock */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Opening Stock Quantity
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="0"
                value={formData.openingStock}
                onChange={(e) => setFormData({ ...formData, openingStock: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              />
            </div>

            {/* Reorder Level */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Low Stock Alert Threshold
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="10"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value, alertStockQty: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem', borderColor: '#fed7aa' }}
              />
            </div>

            {/* Active Status */}
            <div className="form-group" style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Product Active Status
              </label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                style={{ height: '46px', borderRadius: '10px', fontSize: '0.875rem' }}
              >
                <option value="Active">Active (Available for Quotations & Invoicing)</option>
                <option value="Inactive">Inactive (Hidden from catalog)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem', marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn btn-secondary"
            style={{ borderRadius: '10px', padding: '0.75rem 1.6rem', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ borderRadius: '10px', padding: '0.75rem 2rem', fontWeight: 700, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}
          >
            <Save size={18} />
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
