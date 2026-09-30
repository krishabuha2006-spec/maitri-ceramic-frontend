import api, { extractArray } from './api';
import { getUnits } from './masterService';

const isMongoId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v.trim());

// Helper to normalize backend product object
export const normalizeProduct = (p) => {
  if (!p) return null;
  const actual = p.currentStock !== undefined ? p.currentStock : (p.actualStock || p.openingStock || 0);
  const mgmt = p.managementStock || 0;

  const compId = p.company?._id || (isMongoId(p.company) ? p.company : p.companyId) || null;
  const vendId = p.vendor?._id || (isMongoId(p.vendor) ? p.vendor : p.vendorId) || null;
  const grpId = p.productGroup?._id || (isMongoId(p.productGroup) ? p.productGroup : p.productGroupId) || null;
  const uId = p.unit?._id || (isMongoId(p.unit) ? p.unit : p.unitId) || null;

  return {
    ...p,
    _id: p._id || p.id,
    id: p._id || p.id,
    companyId: compId,
    vendorId: vendId,
    productGroupId: grpId,
    unitId: uId,
    sku: p.companySkuCode || p.sku || p.companySku || p.vendorSkuCode || 'SKU-NONE',
    companySkuCode: p.companySkuCode || p.sku || p.companySku || '',
    vendorSkuCode: p.vendorSkuCode || p.vendorSku || '',
    productName: p.productName || p.name || 'Unnamed Product',
    company: p.company?.companyName || p.companyName || (typeof p.company === 'string' && !isMongoId(p.company) ? p.company : ''),
    vendor: p.vendor?.vendorName || p.vendorName || (typeof p.vendor === 'string' && !isMongoId(p.vendor) ? p.vendor : ''),
    productGroup: p.productGroup?.groupName || (typeof p.productGroup === 'string' && !isMongoId(p.productGroup) && p.productGroup.toLowerCase() !== 'general' ? p.productGroup : ''),
    category: p.category || (p.productGroup?.category) || 'Sanitaryware',
    productType: (p.productType && p.productType.toLowerCase() !== 'general' ? p.productType : '') || (p.productGroup?.groupName && p.productGroup.groupName.toLowerCase() !== 'general' ? p.productGroup.groupName : ''),
    productSubType: p.productSubType || '',
    rangeOrSize: p.rangeOrSize || (p.category === 'Tiles' ? p.size : p.range) || '',
    range: p.range || '',
    size: p.size || '',
    colourName: p.colourName || p.color || 'White',
    finish: p.finish || 'Glossy',
    fullDescription: p.fullDescription || p.description || '',
    piecesPerBox: p.piecesPerBox !== undefined && p.piecesPerBox !== null ? p.piecesPerBox : '',
    sqftPerBox: p.sqftPerBox !== undefined && p.sqftPerBox !== null ? p.sqftPerBox : '',
    weightPerBox: p.weightPerBox !== undefined && p.weightPerBox !== null ? p.weightPerBox : '',
    hsnCode: p.hsnCode || '69072100',
    vendorSku: p.vendorSkuCode || p.vendorSku || '',
    companySku: p.companySkuCode || p.companySku || '',
    unit: p.unit?.unitCode || p.unit?.unitName || (typeof p.unit === 'string' && !isMongoId(p.unit) ? p.unit : 'PCS'),
    mrp: Number(p.mrp || 0),
    purchaseRate: Number(p.purchaseRate || 0),
    costRate: Number(p.costRate || p.purchaseRate || 0),
    salePrice: Number(p.salePrice || 0),
    saleDiscount: Number(p.saleDiscount || 0),
    openingStock: Number(p.openingStock || 0),
    openingStockValue: Number(p.openingStockValue || 0),
    currentStock: Number(actual),
    actualStock: Number(actual),
    managementStock: Number(mgmt),
    availableStock: Math.max(0, Number(actual) - Number(mgmt)),
    reorderLevel: Number(p.reorderAlertQty || p.reorderLevel || 10),
    alertStockQty: Number(p.reorderAlertQty || p.alertStockQty || 10),
    defaultQty: Number(p.defaultQuantity || 1),
    status: p.status || (p.isActive === false ? 'Inactive' : 'Active'),
    gstPercent: Number(p.gstPct || p.gstPercent || 18),
    gstPct: Number(p.gstPct || p.gstPercent || 18),
    image: (p.productImage || p.image || '').includes('res.cloudinary.com/maitri/image/upload/statuario.jpg') ? '' : (p.productImage || p.image || '')
  };
};

// In-memory cache for fast responsive lookups
let cachedProducts = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * GET /products - Get all products dynamically from live backend
 */
export const getProducts = async (params = {}, retryCount = 0) => {
  try {
    const queryParams = { limit: params.limit || 200, page: params.page || 1, ...params };
    const res = await api.get('/products', { params: queryParams, timeout: 35000 });
    const rawList = extractArray(res.data, ['products', 'data', 'items', 'list']);
    const normalized = (Array.isArray(rawList) ? rawList : [])
      .map(normalizeProduct)
      .filter(Boolean);

    let list = normalized;
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(p => (p.productName || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    }
    if (params.vendorId) {
      list = list.filter(p => String(p.vendorId) === String(params.vendorId));
    }
    if (params.company) {
      list = list.filter(p => (p.company || '').toLowerCase() === params.company.toLowerCase() || p.companyId === params.company);
    }
    if (params.productGroup) {
      list = list.filter(p => (p.productGroup || '').toLowerCase() === params.productGroup.toLowerCase() || p.productGroupId === params.productGroup);
    }
    if (params.status) {
      list = list.filter(p => p.status === params.status);
    }

    const total = res.data?.data?.pagination?.total || res.data?.total || list.length;
    if (list.length > 0 && !params.search && !params.vendorId && !params.company) {
      cachedProducts = list;
      lastCacheTime = Date.now();
    }

    return { data: list, total };
  } catch (err) {
    const isTimeout = err?.code === 'ECONNABORTED' || (err?.message && err.message.includes('timeout'));
    
    // Auto-retry once on timeout with smaller limit
    if (isTimeout && retryCount < 1) {
      console.warn('GET /products timed out, retrying once with leaner limit...');
      return getProducts({ ...params, limit: 50 }, retryCount + 1);
    }

    // If cache is fresh, gracefully serve cached list
    if (cachedProducts && (Date.now() - lastCacheTime < CACHE_TTL_MS * 5)) {
      console.info('Serving products from memory cache due to network delay');
      let fallbackList = cachedProducts;
      if (params.vendorId) {
        fallbackList = fallbackList.filter(p => String(p.vendorId) === String(params.vendorId));
      }
      return { data: fallbackList, total: fallbackList.length };
    }

    const errMsg = err?.response?.data?.message || err?.message || 'Failed to fetch products from backend';
    console.error('GET /products error:', errMsg);
    return { data: [], total: 0, error: errMsg };
  }
};

/**
 * GET /products/{id} - Get single product details
 */
export const getProductById = async (id) => {
  if (!id) throw new Error('Product ID required');
  try {
    const res = await api.get(`/products/${id}`);
    const raw = res.data?.data?.product || res.data?.data || res.data;
    if (raw) return normalizeProduct(raw);
  } catch (err) {
    const errMsg = err?.response?.data?.message || err?.message || 'Failed to fetch product from backend';
    throw new Error(errMsg);
  }
  throw new Error('Product not found');
};

import { getVendors } from './vendorService';

/**
 * Helper to ensure company, productGroup, unit, and vendor IDs are valid MongoDB ObjectIds
 */
const resolveMasterIds = async (productData) => {
  let compId = isMongoId(productData.companyId) ? productData.companyId : (isMongoId(productData.company) ? productData.company : null);
  const rawCompName = String(productData.companyName || productData.company || productData.brand || '').trim();
  if (!compId && rawCompName) {
    try {
      const comps = await getCompanies();
      const list = Array.isArray(comps) ? comps : (comps?.data || []);
      const found = list.find(c =>
        (c.companyName || c.name || '').toLowerCase().trim() === rawCompName.toLowerCase() ||
        c.id === rawCompName ||
        c._id === rawCompName
      );
      if (found && isMongoId(found._id || found.id)) {
        compId = found._id || found.id;
      } else {
        // Auto create company on the fly if not exists
        const createdComp = await createCompany({
          companyName: rawCompName,
          companyType: 'BRAND_MANUFACTURER',
          isActive: true
        }).catch(() => null);
        if (createdComp && isMongoId(createdComp._id || createdComp.id)) {
          compId = createdComp._id || createdComp.id;
        }
      }
    } catch {
      // Ignore lookup error
    }
  }

  let grpId = isMongoId(productData.productGroupId) ? productData.productGroupId : (isMongoId(productData.productGroup) ? productData.productGroup : null);
  const rawGrpName = String(productData.groupName || productData.productGroup || productData.productType || '').trim();
  if (!grpId && rawGrpName) {
    try {
      const grps = await getProductGroups();
      const list = Array.isArray(grps) ? grps : (grps?.data || []);
      const target = rawGrpName.toLowerCase();
      const found = list.find(g =>
        (g.groupName || g.name || g.typeName || '').toLowerCase().trim() === target ||
        g.id === rawGrpName ||
        g._id === rawGrpName
      );
      if (found && isMongoId(found._id || found.id)) {
        grpId = found._id || found.id;
      } else {
        // Auto create group on the fly if not exists
        const createdGrp = await createProductGroup({
          groupName: rawGrpName,
          category: productData.category || 'Sanitaryware',
          isActive: true
        }).catch(() => null);
        if (createdGrp && isMongoId(createdGrp._id || createdGrp.id)) {
          grpId = createdGrp._id || createdGrp.id;
        }
      }
    } catch {
      // Ignore lookup error
    }
  }

  let unitId = isMongoId(productData.unitId) ? productData.unitId : (isMongoId(productData.unit) ? productData.unit : null);
  const rawUnitName = String(productData.unitName || productData.unit || 'PCS').trim();
  if (!unitId) {
    try {
      const units = await getUnits();
      const list = Array.isArray(units) ? units : (units?.data || []);
      const targetUnit = rawUnitName.toLowerCase();
      const found = list.find(u =>
        (u.unitCode || u.unitName || '').toLowerCase().trim() === targetUnit ||
        u.id === rawUnitName ||
        u._id === rawUnitName
      );
      if (found && isMongoId(found._id || found.id)) {
        unitId = found._id || found.id;
      } else if (list.length > 0 && isMongoId(list[0]._id || list[0].id)) {
        unitId = list[0]._id || list[0].id;
      }
    } catch {
      // Ignore lookup error
    }
  }

  let vendId = isMongoId(productData.vendorId) ? productData.vendorId : (isMongoId(productData.vendor) ? productData.vendor : null);
  const rawVenName = String(productData.vendorName || productData.vendor || '').trim();
  if (!vendId && rawVenName) {
    try {
      const vendors = await getVendors();
      const list = Array.isArray(vendors) ? vendors : (vendors?.data || []);
      const found = list.find(v =>
        (v.vendorName || v.name || '').toLowerCase() === rawVenName.toLowerCase() ||
        v.id === rawVenName ||
        v._id === rawVenName
      );
      if (found && isMongoId(found._id || found.id)) {
        vendId = found._id || found.id;
      }
    } catch {
      // Ignore lookup error
    }
  }

  return {
    compId: isMongoId(compId) ? compId : null,
    grpId: isMongoId(grpId) ? grpId : null,
    unitId: isMongoId(unitId) ? unitId : null,
    vendId: isMongoId(vendId) ? vendId : null
  };
};

/**
 * POST /products - Create product directly on live backend
 */
export const createProduct = async (productData) => {
  const pName = productData.productName || productData.name || 'Unnamed Product';
  const skuCode = productData.sku || productData.companySkuCode || productData.companySku || `SKU-${Date.now()}`;
  const rawImage = productData.image || productData.productImage || '';
  const isOversized = typeof rawImage === 'string' && rawImage.startsWith('data:') && rawImage.length > 5000000;
  const networkImage = isOversized ? '' : rawImage;

  const { compId, grpId, unitId, vendId } = await resolveMasterIds(productData);

  const livePayload = {
    productName: pName,
    companySkuCode: skuCode,
    vendorSkuCode: productData.vendorSku || productData.vendorSkuCode || '',
    hsnCode: productData.hsnCode || '69072100',
    category: productData.category || 'Sanitaryware',
    productType: productData.productType || productData.productGroup || null,
    productSubType: productData.productSubType || null,
    rangeOrSize: productData.rangeOrSize || null,
    range: productData.range || null,
    size: productData.size || null,
    colourName: productData.colourName || null,
    finish: productData.finish || null,
    fullDescription: productData.fullDescription || productData.description || null,
    piecesPerBox: productData.piecesPerBox !== undefined && productData.piecesPerBox !== '' && productData.piecesPerBox !== null ? Number(productData.piecesPerBox) : null,
    sqftPerBox: productData.sqftPerBox !== undefined && productData.sqftPerBox !== '' && productData.sqftPerBox !== null ? Number(productData.sqftPerBox) : null,
    weightPerBox: productData.weightPerBox !== undefined && productData.weightPerBox !== '' && productData.weightPerBox !== null ? Number(productData.weightPerBox) : null,
    productImage: networkImage || null,
    mrp: Number(productData.mrp || 0),
    purchaseRate: Number(productData.purchaseRate || 0),
    costRate: Number(productData.costRate || productData.purchaseRate || 0),
    salePrice: Number(productData.salePrice || 0),
    saleDiscount: Number(productData.saleDiscount || 0),
    reorderAlertQty: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    gstPct: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    igstPct: Number(productData.igstPercent ?? productData.igstPct ?? productData.gstPercent ?? 18),
    cgstPct: Number(productData.cgstPercent ?? productData.cgstPct ?? ((productData.gstPercent || 18) / 2)),
    sgstPct: Number(productData.sgstPercent ?? productData.sgstPct ?? ((productData.gstPercent || 18) / 2)),
    status: productData.status || 'Active',
    description: productData.fullDescription || productData.description || '',
    openingStock: Number(productData.openingStock || 0),
    openingStockValue: Number(productData.openingStockValue || 0),
    company: compId,
    companyName: productData.companyName || productData.company || productData.brand || null,
    productGroup: grpId,
    groupName: productData.groupName || productData.productGroup || productData.productType || null,
    unit: unitId,
    unitName: productData.unitName || productData.unit || 'PCS',
    vendor: vendId,
    vendorName: productData.vendorName || productData.vendor || null
  };

  try {
    const res = await api.post('/products', livePayload);
    const created = res.data?.data || res.data;
    return normalizeProduct(created);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create product on backend.';
    throw new Error(serverMsg);
  }
};

/**
 * PUT /products/{id} - Update product directly on live backend
 */
export const updateProduct = async (id, productData) => {
  const pName = productData.productName || productData.name || 'Unnamed Product';
  const skuCode = productData.sku || productData.companySkuCode || productData.companySku || `SKU-${Date.now()}`;
  const rawImage = productData.image || productData.productImage || '';
  const isOversized = typeof rawImage === 'string' && rawImage.startsWith('data:') && rawImage.length > 5000000;
  const networkImage = isOversized ? '' : rawImage;

  const { compId, grpId, unitId, vendId } = await resolveMasterIds(productData);

  const livePayload = {
    productName: pName,
    companySkuCode: skuCode,
    vendorSkuCode: productData.vendorSku || productData.vendorSkuCode || '',
    hsnCode: productData.hsnCode || '69072100',
    category: productData.category || 'Sanitaryware',
    productType: productData.productType || productData.productGroup || null,
    productSubType: productData.productSubType || null,
    rangeOrSize: productData.rangeOrSize || null,
    range: productData.range || null,
    size: productData.size || null,
    colourName: productData.colourName || null,
    finish: productData.finish || null,
    fullDescription: productData.fullDescription || productData.description || null,
    piecesPerBox: productData.piecesPerBox !== undefined && productData.piecesPerBox !== '' && productData.piecesPerBox !== null ? Number(productData.piecesPerBox) : null,
    sqftPerBox: productData.sqftPerBox !== undefined && productData.sqftPerBox !== '' && productData.sqftPerBox !== null ? Number(productData.sqftPerBox) : null,
    weightPerBox: productData.weightPerBox !== undefined && productData.weightPerBox !== '' && productData.weightPerBox !== null ? Number(productData.weightPerBox) : null,
    productImage: networkImage || null,
    mrp: Number(productData.mrp || 0),
    purchaseRate: Number(productData.purchaseRate || 0),
    costRate: Number(productData.costRate || productData.purchaseRate || 0),
    salePrice: Number(productData.salePrice || 0),
    saleDiscount: Number(productData.saleDiscount || 0),
    reorderAlertQty: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    gstPct: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    igstPct: Number(productData.igstPercent ?? productData.igstPct ?? productData.gstPercent ?? 18),
    cgstPct: Number(productData.cgstPercent ?? productData.cgstPct ?? ((productData.gstPercent || 18) / 2)),
    sgstPct: Number(productData.sgstPercent ?? productData.sgstPct ?? ((productData.gstPercent || 18) / 2)),
    status: productData.status || 'Active',
    description: productData.fullDescription || productData.description || '',
    company: compId,
    companyName: productData.companyName || productData.company || productData.brand || null,
    productGroup: grpId,
    groupName: productData.groupName || productData.productGroup || productData.productType || null,
    unit: unitId,
    unitName: productData.unitName || productData.unit || 'PCS',
    vendor: vendId,
    vendorName: productData.vendorName || productData.vendor || null
  };

  try {
    const res = await api.put(`/products/${id}`, livePayload);
    const updated = res.data?.data || res.data;
    return normalizeProduct(updated);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to update product on backend.';
    throw new Error(serverMsg);
  }
};

/**
 * PUT /products/{id}/deactivate - Toggle product active status
 */
export const toggleProductStatus = async (id) => {
  try {
    const res = await api.put(`/products/${id}/deactivate`);
    const updated = res.data?.data || res.data;
    return normalizeProduct(updated);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to toggle product status.';
    throw new Error(serverMsg);
  }
};

/**
 * DELETE /products/{id} - Delete product directly on live backend
 */
export const deleteProduct = async (id) => {
  try {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to delete product on backend.';
    throw new Error(serverMsg);
  }
};

/**
 * POST /products/bulk-delete - Delete multiple products by IDs
 */
export const bulkDeleteProducts = async (productIds = []) => {
  try {
    const res = await api.post('/products/bulk-delete', { productIds });
    return res.data;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to bulk delete products.';
    throw new Error(serverMsg);
  }
};

/**
 * DELETE /products/delete-all - Delete ALL products from database
 */
export const deleteAllProducts = async () => {
  try {
    const res = await api.delete('/products/delete-all');
    return res.data;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to delete all products.';
    throw new Error(serverMsg);
  }
};

/**
 * GET /products/search-by-sku
 */
export const searchProductsBySku = async (sku) => {
  try {
    const res = await api.get('/products/search-by-sku', { params: { sku } });
    const rawList = extractArray(res.data, ['products']);
    return rawList.map(normalizeProduct);
  } catch (err) {
    return [];
  }
};

/**
 * GET /products/low-stock
 */
export const getLowStockProducts = async () => {
  try {
    const res = await api.get('/products/low-stock');
    const rawList = extractArray(res.data, ['products', 'data']);
    if (Array.isArray(rawList)) {
      return rawList.map(normalizeProduct);
    }
  } catch (err) { }
  return [];
};

/**
 * GET /products/export
 */
export const exportProductCatalog = async (format = 'excel') => {
  try {
    const res = await api.get('/products/export', { params: { format }, responseType: 'blob' });
    return res.data;
  } catch (err) {
    throw err;
  }
};

/**
 * GET /products/{id}/quotation-usage
 */
export const getProductQuotationUsage = async (id) => {
  try {
    const res = await api.get(`/products/${id}/quotation-usage`);
    return res.data?.data || res.data;
  } catch (err) {
    return { quotations: [], count: 0 };
  }
};

/**
 * POST /products/upload-image - Upload product image to Cloudinary
 */
export const uploadProductImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await api.post('/products/upload-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return res.data?.data || res.data;
};

// ==========================================
// --- Module 2: Company Master Endpoints ---
// ==========================================

export const getCompanies = async () => {
  try {
    const res = await api.get('/companies');
    const rawList = extractArray(res.data, ['companies', 'companyList', 'data']);
    if (Array.isArray(rawList)) {
      return rawList.map(c => ({
        _id: c._id || c.id,
        id: c._id || c.id,
        companyName: c.companyName || c.name || c.brandName || '',
        companyType: c.companyType || (c.isOwnCompany ? 'OWN' : 'BRAND_MANUFACTURER'),
        isOwnCompany: c.companyType === 'OWN' || !!c.isOwnCompany,
        gstNumber: c.gstNumber || '',
        address: c.address || '',
        contactPerson: c.contactPerson || '',
        contactMobile: c.contactMobile || '',
        logo: c.logo || null,
        status: c.status || (c.isActive === false ? 'Inactive' : 'Active'),
        isActive: c.isActive !== false && c.status !== 'Inactive'
      }));
    }
  } catch (err) {
    console.error('GET /companies error:', err?.message);
  }
  return [];
};

export const getCompanyById = async (id) => {
  try {
    const res = await api.get(`/companies/${id}`);
    return res.data?.data || res.data;
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Company not found');
  }
};

export const createCompany = async (data) => {
  const payload = {
    companyName: data.companyName ? data.companyName.trim() : (data.name ? data.name.trim() : ''),
    companyType: data.isOwnCompany || data.companyType === 'OWN' ? 'OWN' : (data.companyType || 'BRAND_MANUFACTURER'),
    gstNumber: data.gstNumber ? data.gstNumber.trim().toUpperCase() : null,
    address: data.address ? data.address.trim() : null,
    contactPerson: data.contactPerson ? data.contactPerson.trim() : null,
    contactMobile: data.contactMobile ? data.contactMobile.trim() : null,
    logo: data.logo || null
  };

  try {
    const res = await api.post('/companies', payload);
    return res.data?.data || res.data;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create company.';
    throw new Error(serverMsg);
  }
};

export const updateCompany = async (id, data) => {
  try {
    const payload = {
      companyName: data.companyName ? data.companyName.trim() : (data.name ? data.name.trim() : ''),
      companyType: data.isOwnCompany || data.companyType === 'OWN' ? 'OWN' : (data.companyType || 'BRAND_MANUFACTURER'),
      gstNumber: data.gstNumber !== undefined ? (data.gstNumber ? data.gstNumber.trim().toUpperCase() : null) : undefined,
      address: data.address !== undefined ? (data.address ? data.address.trim() : null) : undefined,
      contactPerson: data.contactPerson !== undefined ? (data.contactPerson ? data.contactPerson.trim() : null) : undefined,
      contactMobile: data.contactMobile !== undefined ? (data.contactMobile ? data.contactMobile.trim() : null) : undefined,
      logo: data.logo !== undefined ? (data.logo || null) : undefined,
      isActive: data.isActive !== undefined ? data.isActive : (data.status ? data.status === 'Active' : true)
    };
    const res = await api.put(`/companies/${id}`, payload);
    return res.data?.data || res.data;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to update company.';
    throw new Error(serverMsg);
  }
};

export const toggleCompanyStatus = async (id, currentIsActive) => {
  try {
    if (currentIsActive) {
      const res = await api.put(`/companies/${id}/deactivate`);
      return res.data;
    } else {
      const res = await api.put(`/companies/${id}`, { isActive: true });
      return res.data;
    }
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to toggle company status.';
    throw new Error(serverMsg);
  }
};

export const deactivateCompany = async (id) => {
  try {
    const res = await api.put(`/companies/${id}/deactivate`);
    return res.data;
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Failed to deactivate company.');
  }
};

// ================================================
// --- Module 2: Product Group Master Endpoints ---
// ================================================

export const normalizeProductGroup = (g) => {
  if (!g) return null;
  return {
    _id: g._id || g.id,
    id: g._id || g.id,
    groupName: g.groupName || g.group_name || g.name || g.categoryName || g.title || 'Unnamed Group',
    groupCode: g.groupCode || g.group_code || g.code || g.prefix || '',
    description: g.description || g.details || g.desc || '',
    parentGroup: typeof g.parentGroup === 'object' ? (g.parentGroup?.groupName || g.parentGroup?.name || '') : (g.parentGroup || g.parent_group || g.parent || ''),
    status: g.status || (g.isActive === false || g.is_active === false ? 'Inactive' : 'Active'),
    isActive: g.isActive !== false && g.status !== 'Inactive'
  };
};

export const getProductGroups = async () => {
  try {
    const res = await api.get('/product-groups');
    const rawList = extractArray(res.data, ['productGroups', 'product_groups', 'groups', 'categories', 'data', 'items', 'list']);
    if (Array.isArray(rawList)) {
      return rawList.map(normalizeProductGroup).filter(Boolean);
    }
  } catch (err) {
    console.error('GET /product-groups error:', err?.message);
  }
  return [];
};

export const createProductGroup = async (data) => {
  const payload = {
    groupName: data.groupName || data.name,
    description: data.description || '',
    isActive: data.status === 'Active' || data.isActive !== false
  };

  try {
    const res = await api.post('/product-groups', payload);
    const created = res.data?.data || res.data;
    return normalizeProductGroup(created);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create product group.';
    throw new Error(serverMsg);
  }
};

export const updateProductGroup = async (id, data) => {
  try {
    const payload = {
      groupName: data.groupName || data.name,
      description: data.description || '',
      isActive: data.status === 'Active' || data.isActive !== false
    };
    const res = await api.put(`/product-groups/${id}`, payload);
    const updated = res.data?.data || res.data;
    return normalizeProductGroup(updated);
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Failed to update product group.');
  }
};

export const deleteProductGroup = async (id) => {
  try {
    const res = await api.delete(`/product-groups/${id}`);
    return res.data;
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Failed to delete product group.');
  }
};

export const deactivateProductGroup = async (id) => {
  try {
    const res = await api.put(`/product-groups/${id}/deactivate`);
    const updated = res.data?.data || res.data;
    return normalizeProductGroup(updated);
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Failed to toggle product group status.');
  }
};

// ==========================================
// --- Module 2: Vendor Master Endpoints ---
// ==========================================
export {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  toggleVendorStatus,
  deactivateVendor
} from './vendorService';

