import api, { extractArray, hasRealJwtToken } from './api';

const PRODUCT_STORAGE_KEY = 'maitri_local_products';
const DELETED_PRODUCTS_KEY = 'maitri_deleted_product_ids';

const getDeletedProductIds = () => {
  try {
    const data = localStorage.getItem(DELETED_PRODUCTS_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {}
  return [];
};

const addDeletedProductId = (id, sku = '') => {
  try {
    const list = getDeletedProductIds();
    if (id && !list.includes(String(id))) list.push(String(id));
    if (sku && !list.includes(String(sku))) list.push(String(sku));
    localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(list));
  } catch (err) {}
};

const getStoredProducts = () => {
  try {
    const data = localStorage.getItem(PRODUCT_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {}
  return [];
};

const saveStoredProducts = (list) => {
  try {
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {}
};

// Helper to normalize backend product object
const normalizeProduct = (p) => {
  if (!p) return { id: `PRD-${Date.now()}`, sku: 'SKU-NONE', productName: 'Unnamed Product', status: 'Active' };
  const actual = p.currentStock !== undefined ? p.currentStock : (p.actualStock || p.openingStock || 0);
  const mgmt = p.managementStock || 0;
  const isMongoId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

  const compId = p.company?._id || (isMongoId(p.company) ? p.company : p.companyId) || null;
  const grpId = p.productGroup?._id || (isMongoId(p.productGroup) ? p.productGroup : p.productGroupId) || null;
  const uId = p.unit?._id || (isMongoId(p.unit) ? p.unit : p.unitId) || null;

  return {
    _id: p._id || p.id || `PRD-${Date.now()}`,
    id: p._id || p.id || `PRD-${Date.now()}`,
    companyId: compId,
    productGroupId: grpId,
    unitId: uId,
    sku: p.companySkuCode || p.sku || p.companySku || p.vendorSkuCode || 'SKU-NONE',
    productName: p.productName || p.name || 'Unnamed Product',
    company: p.company?.companyName || p.company || 'Maitri Ceramic',
    productGroup: p.productGroup?.groupName || p.productGroup || 'Tiles',
    hsnCode: p.hsnCode || '69072100',
    vendorSku: p.vendorSkuCode || p.vendorSku || '',
    companySku: p.companySkuCode || p.companySku || '',
    unit: p.unit?.unitCode || p.unit?.unitName || p.unit || 'Sq.Ft',
    mrp: Number(p.mrp || 0) > 0 ? Number(p.mrp) : (Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.purchaseRate || 0)),
    purchaseRate: Number(p.purchaseRate || 0),
    costRate: Number(p.costRate || p.purchaseRate || 0),
    salePrice: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : (Number(p.mrp || 0) > 0 ? Number(p.mrp) : Number(p.purchaseRate || 0)),
    saleDiscount: p.saleDiscount || 0,
    openingStock: p.openingStock || 0,
    openingStockValue: p.openingStockValue || 0,
    currentStock: actual,
    actualStock: actual,
    managementStock: mgmt,
    availableStock: Math.max(0, actual - mgmt),
    reorderLevel: p.reorderAlertQty || p.reorderLevel || 10,
    alertStockQty: p.reorderAlertQty || p.alertStockQty || 10,
    defaultQty: p.defaultQuantity || 1,
    status: p.status || (p.isActive === false ? 'Inactive' : 'Active'),
    gstPercent: p.gstPct || p.gstPercent || 18,
    image: (p.productImage || p.image || '').includes('res.cloudinary.com/maitri/image/upload/statuario.jpg') ? '' : (p.productImage || p.image || '')
  };
};

export const getProducts = async (params = {}) => {
  const deleted = getDeletedProductIds();
  try {
    const queryParams = { limit: 1000, page: 1, ...params };
    const res = await api.get('/products', { params: queryParams });
    const rawList = extractArray(res.data, ['products', 'data', 'items', 'list']);
    if (Array.isArray(rawList)) {
      const normalized = rawList
        .map(normalizeProduct)
        .filter(p => !deleted.includes(String(p.id)) && !deleted.includes(String(p.sku)));
      const total = res.data?.data?.pagination?.total || res.data?.total || normalized.length;
      return { data: normalized, total };
    }
  } catch (err) {
    console.error('GET /products failed:', err?.response?.data || err.message);
  }

  const stored = getStoredProducts();
  let list = stored
    .map(normalizeProduct)
    .filter(p => !deleted.includes(String(p.id)) && !deleted.includes(String(p.sku)));

  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(p => (p.productName || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }
  if (params.company) {
    list = list.filter(p => p.company === params.company);
  }
  if (params.productGroup) {
    list = list.filter(p => p.productGroup === params.productGroup);
  }
  if (params.status) {
    list = list.filter(p => p.status === params.status);
  }

  return { data: list, total: list.length };
};

export const getProductById = async (id) => {
  if (!id) throw new Error('Product ID required');

  // Only call backend if the ID looks like a real MongoDB ObjectId (24-char hex)
  const isMongoId = /^[a-f\d]{24}$/i.test(String(id));

  if (isMongoId) {
    try {
      const res = await api.get(`/products/${id}`);
      const raw = res.data?.data?.product || res.data?.data || res.data;
      if (raw) return normalizeProduct(raw);
    } catch (err) {
      console.warn('GET /products/:id failed:', err?.response?.data || err.message);
    }
  }

  // Fallback: search localStorage by id or sku
  const stored = getStoredProducts();
  const prd = stored.find(p => String(p.id) === String(id) || String(p._id) === String(id) || p.sku === id);
  if (prd) return normalizeProduct(prd);

  return normalizeProduct({ id, productName: 'Product Record', sku: String(id) });
};

export const createProduct = async (productData) => {
  const pName = productData.productName || productData.name || 'Unnamed Product';
  const skuCode = productData.sku || productData.companySkuCode || productData.companySku || `SKU-${Date.now()}`;
  const compName = productData.company || 'Maitri Ceramic';
  const grpName = productData.productGroup || 'Tiles';
  const unitName = productData.unit || 'Sq.Ft';

  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());

  // Resolve MongoDB ObjectId references if available
  let compId = isMongoId(productData.companyId) ? productData.companyId : (isMongoId(productData.company) ? productData.company : null);
  if (!compId) {
    const compObj = getStoredCompanies().find(c => (c.companyName || c.name || '').toLowerCase() === compName.toLowerCase() || c.id === productData.company);
    if (compObj && isMongoId(compObj._id || compObj.id)) compId = compObj._id || compObj.id;
  }

  let grpId = isMongoId(productData.productGroupId) ? productData.productGroupId : (isMongoId(productData.productGroup) ? productData.productGroup : null);
  if (!grpId) {
    const grpObj = getStoredProductGroups().find(g => (g.groupName || g.name || '').toLowerCase() === grpName.toLowerCase() || g.id === productData.productGroup);
    if (grpObj && isMongoId(grpObj._id || grpObj.id)) grpId = grpObj._id || grpObj.id;
  }

  let unitId = isMongoId(productData.unitId) ? productData.unitId : (isMongoId(productData.unit) ? productData.unit : null);
  if (!unitId) {
    try {
      const rawUnits = localStorage.getItem('maitri_unit_master');
      if (rawUnits) {
        const parsed = JSON.parse(rawUnits);
        if (Array.isArray(parsed)) {
          const uObj = parsed.find(u => 
            (u.unitCode || u.unitName || '').toLowerCase() === unitName.toLowerCase() ||
            u.id === productData.unit ||
            u.id === productData.unitId
          );
          if (uObj && isMongoId(uObj._id || uObj.id)) unitId = uObj._id || uObj.id;
        }
      }
    } catch (e) {}
  }

  // Sanitize image for network: strip oversized base64 to avoid Vercel 413 Content Too Large
  const rawImage = productData.image || productData.productImage || '';
  const isOversized = typeof rawImage === 'string' && rawImage.startsWith('data:') && rawImage.length > 150000;
  const networkImage = isOversized ? '' : rawImage;

  // Clean schema-compliant payload for live backend
  const livePayload = {
    productName: pName,
    companySkuCode: skuCode,
    vendorSkuCode: productData.vendorSku || productData.vendorSkuCode || '',
    company: compId,
    productGroup: grpId,
    hsnCode: productData.hsnCode || '69072100',
    mrp: Number(productData.mrp || 0),
    purchaseRate: Number(productData.purchaseRate || 0),
    costRate: Number(productData.costRate || productData.purchaseRate || 0),
    salePrice: Number(productData.salePrice || 0),
    saleDiscount: Number(productData.saleDiscount || 0),
    reorderAlertQty: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    gstPct: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    status: productData.status || 'Active',
    description: productData.description || ''
  };

  if (unitId) {
    livePayload.unit = unitId;
  }
  if (networkImage) {
    livePayload.productImage = networkImage;
  }

  const newId = `PRD-${Date.now()}`;
  const localProduct = normalizeProduct({
    _id: newId,
    id: newId,
    productName: pName,
    company: compName,
    companyId: compId,
    productGroup: grpName,
    productGroupId: grpId,
    unit: unitName,
    unitId: unitId,
    sku: skuCode,
    companySkuCode: skuCode,
    vendorSkuCode: productData.vendorSku || productData.vendorSkuCode || '',
    hsnCode: productData.hsnCode || '69072100',
    mrp: Number(productData.mrp || 0),
    purchaseRate: Number(productData.purchaseRate || 0),
    costRate: Number(productData.costRate || productData.purchaseRate || 0),
    salePrice: Number(productData.salePrice || 0),
    saleDiscount: Number(productData.saleDiscount || 0),
    openingStock: Number(productData.openingStock || 0),
    openingStockValue: Number(productData.openingStockValue || 0),
    currentStock: Number(productData.openingStock || 0),
    actualStock: Number(productData.openingStock || 0),
    reorderLevel: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    reorderAlertQty: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    gstPercent: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    gstPct: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    description: productData.description || '',
    status: productData.status || 'Active',
    image: rawImage
  });

  // Only dispatch live POST when valid JWT and all required Mongo ObjectIds exist
  if (hasRealJwtToken() && compId && grpId && unitId) {
    try {
      const res = await api.post('/products', {
        ...livePayload,
        openingStock: Number(productData.openingStock || 0),
        openingStockValue: Number(productData.openingStockValue || 0)
      });
      const created = res.data?.data || res.data;
      const normalized = normalizeProduct(created || localProduct);
      if (rawImage && !normalized.image) normalized.image = rawImage;

      const stored = getStoredProducts();
      stored.unshift(normalized);
      saveStoredProducts(stored);

      return normalized;
    } catch (err) {
      // Graceful local store fallback
    }
  }

  // Save to local storage cache so product is immediately available in UI
  const stored = getStoredProducts();
  stored.unshift(localProduct);
  saveStoredProducts(stored);
  return localProduct;
};

export const updateProduct = async (id, productData) => {
  const pName = productData.productName || productData.name || 'Unnamed Product';
  const skuCode = productData.sku || productData.companySkuCode || productData.companySku || `SKU-${Date.now()}`;
  const compName = productData.company || 'Maitri Ceramic';
  const grpName = productData.productGroup || 'Tiles';
  const unitName = productData.unit || 'Sq.Ft';

  const rawImage = productData.image || productData.productImage || '';
  const isOversized = typeof rawImage === 'string' && rawImage.startsWith('data:') && rawImage.length > 150000;
  const networkImage = isOversized ? '' : rawImage;

  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
  let compId = isMongoId(productData.companyId) ? productData.companyId : (isMongoId(productData.company) ? productData.company : null);
  if (!compId) {
    const compObj = getStoredCompanies().find(c => (c.companyName || c.name || '').toLowerCase() === compName.toLowerCase() || c.id === productData.company);
    if (compObj && isMongoId(compObj._id || compObj.id)) compId = compObj._id || compObj.id;
  }

  let grpId = isMongoId(productData.productGroupId) ? productData.productGroupId : (isMongoId(productData.productGroup) ? productData.productGroup : null);
  if (!grpId) {
    const grpObj = getStoredProductGroups().find(g => (g.groupName || g.name || '').toLowerCase() === grpName.toLowerCase() || g.id === productData.productGroup);
    if (grpObj && isMongoId(grpObj._id || grpObj.id)) grpId = grpObj._id || grpObj.id;
  }

  let unitId = isMongoId(productData.unitId) ? productData.unitId : (isMongoId(productData.unit) ? productData.unit : null);
  if (!unitId) {
    try {
      const rawUnits = localStorage.getItem('maitri_unit_master');
      if (rawUnits) {
        const parsed = JSON.parse(rawUnits);
        if (Array.isArray(parsed)) {
          const uObj = parsed.find(u => 
            (u.unitCode || u.unitName || '').toLowerCase() === unitName.toLowerCase() ||
            u.id === productData.unit ||
            u.id === productData.unitId
          );
          if (uObj && isMongoId(uObj._id || uObj.id)) unitId = uObj._id || uObj.id;
        }
      }
    } catch (e) {}
  }

  // Schema-compliant live backend payload
  const livePayload = {
    productName: pName,
    companySkuCode: skuCode,
    vendorSkuCode: productData.vendorSku || productData.vendorSkuCode || '',
    company: compId,
    productGroup: grpId,
    hsnCode: productData.hsnCode || '69072100',
    mrp: Number(productData.mrp || 0),
    purchaseRate: Number(productData.purchaseRate || 0),
    costRate: Number(productData.costRate || productData.purchaseRate || 0),
    salePrice: Number(productData.salePrice || 0),
    saleDiscount: Number(productData.saleDiscount || 0),
    reorderAlertQty: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    gstPct: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    status: productData.status || 'Active',
    description: productData.description || ''
  };

  if (unitId) {
    livePayload.unit = unitId;
  }
  if (networkImage) {
    livePayload.productImage = networkImage;
  }

  const localProduct = normalizeProduct({
    id,
    _id: id,
    productName: pName,
    company: compName,
    companyId: compId,
    productGroup: grpName,
    productGroupId: grpId,
    unit: unitName,
    unitId: unitId,
    sku: skuCode,
    companySkuCode: skuCode,
    vendorSkuCode: productData.vendorSku || productData.vendorSkuCode || '',
    hsnCode: productData.hsnCode || '69072100',
    mrp: Number(productData.mrp || 0),
    purchaseRate: Number(productData.purchaseRate || 0),
    costRate: Number(productData.costRate || productData.purchaseRate || 0),
    salePrice: Number(productData.salePrice || 0),
    saleDiscount: Number(productData.saleDiscount || 0),
    reorderLevel: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    reorderAlertQty: Number(productData.reorderAlertQty || productData.reorderLevel || 10),
    gstPercent: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    gstPct: Number(productData.gstPercent ?? productData.gstPct ?? 18),
    description: productData.description || '',
    status: productData.status || 'Active',
    image: rawImage
  });

  if (hasRealJwtToken() && isMongoId(id) && compId && grpId && unitId) {
    try {
      const res = await api.put(`/products/${id}`, livePayload);
      const updated = res.data?.data || res.data;
      const normalized = normalizeProduct(updated);
      if (rawImage && !normalized.image) normalized.image = rawImage;

      const stored = getStoredProducts();
      const idx = stored.findIndex(p => String(p.id) === String(id) || String(p._id) === String(id));
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], ...normalized };
        saveStoredProducts(stored);
      }
      return normalized;
    } catch (err) {}
  }

  const stored = getStoredProducts();
  const idx = stored.findIndex(p => String(p.id) === String(id) || String(p._id) === String(id));
  if (idx !== -1) {
    stored[idx] = { ...stored[idx], ...localProduct };
    saveStoredProducts(stored);
  } else {
    stored.unshift(localProduct);
    saveStoredProducts(stored);
  }
  return localProduct;
};

export const toggleProductStatus = async (id) => {
  try {
    const res = await api.put(`/products/${id}/deactivate`);
    const updated = res.data?.data || res.data;
    const normalized = normalizeProduct(updated);

    const stored = getStoredProducts();
    const idx = stored.findIndex(p => String(p.id) === String(id) || String(p._id) === String(id));
    if (idx !== -1) {
      stored[idx] = { ...stored[idx], ...normalized };
      saveStoredProducts(stored);
    }
    return normalized;
  } catch (err) {
    const stored = getStoredProducts();
    const idx = stored.findIndex(p => String(p.id) === String(id) || String(p._id) === String(id));
    if (idx !== -1) {
      stored[idx].status = stored[idx].status === 'Active' ? 'Inactive' : 'Active';
      saveStoredProducts(stored);
      return normalizeProduct(stored[idx]);
    }
    return { success: true, message: 'Product status updated.' };
  }
};

// DELETE /products/{id} - Permanently delete product & cascade cleanup
export const deleteProduct = async (id, sku = '') => {
  addDeletedProductId(id, sku);
  try {
    await api.delete(`/products/${id}`);
  } catch (err) {}

  const stored = getStoredProducts().filter(p => String(p.id) !== String(id) && String(p._id) !== String(id) && p.sku !== sku);
  saveStoredProducts(stored);
  return { success: true, message: 'Product deleted successfully.' };
};

// GET /products/search-by-sku
export const searchProductsBySku = async (sku) => {
  try {
    const res = await api.get('/products/search-by-sku', { params: { sku } });
    const rawList = extractArray(res.data, ['products']);
    return rawList.map(normalizeProduct);
  } catch (err) {}
  return [];
};

// GET /products/low-stock
export const getLowStockProducts = async () => {
  try {
    const { data: allProducts } = await getProducts();
    if (Array.isArray(allProducts) && allProducts.length > 0) {
      return allProducts.filter(p => (p.actualStock || p.currentStock || 0) <= (p.reorderLevel || 10));
    }
  } catch (err) {}
  return [];
};

// GET /products/export
export const exportProductCatalog = async (format = 'excel') => {
  try {
    const res = await api.get('/products/export', { params: { format }, responseType: 'blob' });
    return res.data;
  } catch (err) {}
};

// GET /products/{id}/quotation-usage
export const getProductQuotationUsage = async (id) => {
  try {
    const res = await api.get(`/products/${id}/quotation-usage`);
    return res.data?.data || res.data;
  } catch (err) {}
  return { quotations: [], count: 0 };
};

const COMPANY_STORAGE_KEY = 'maitri_local_companies';
const DELETED_COMPANIES_KEY = 'maitri_deleted_company_ids';

const getDeletedCompanyIds = () => {
  try {
    const data = localStorage.getItem(DELETED_COMPANIES_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {}
  return [];
};

const addDeletedCompanyId = (id, name = '') => {
  try {
    const list = getDeletedCompanyIds();
    if (id && !list.includes(String(id))) list.push(String(id));
    if (name && !list.includes(String(name))) list.push(String(name));
    localStorage.setItem(DELETED_COMPANIES_KEY, JSON.stringify(list));
  } catch (err) {}
};

const getStoredCompanies = () => {
  try {
    const data = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {}
  return [];
};

const saveStoredCompanies = (list) => {
  try {
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {}
};

// --- Module 2: Company Master Endpoints ---
export const getCompanies = async () => {
  const deleted = getDeletedCompanyIds();
  try {
    const res = await api.get('/companies');
    const rawList = extractArray(res.data, ['companies', 'companyList', 'data']);
    if (Array.isArray(rawList)) {
      return rawList
        .map(c => ({
          id: c._id || c.id,
          companyName: c.companyName || c.name || c.brandName,
          code: c.code || c.prefix || '',
          isOwnCompany: !!c.isOwnCompany,
          status: c.status || 'Active'
        }))
        .filter(c => !deleted.includes(String(c.id)) && !deleted.includes(String(c.companyName)));
    }
  } catch (err) {}
  
  const stored = getStoredCompanies();
  return stored.filter(c => !deleted.includes(String(c.id)) && !deleted.includes(String(c.companyName)));
};

export const getCompanyById = async (id) => {
  try {
    const res = await api.get(`/companies/${id}`);
    return res.data?.data || res.data;
  } catch (err) {
    const list = getStoredCompanies();
    const found = list.find(c => String(c.id) === String(id) || c.companyName === id);
    if (found) return found;
    throw new Error('Company not found');
  }
};

export const createCompany = async (data) => {
  const payload = {
    companyName: data.companyName || data.name,
    code: data.code || '',
    isOwnCompany: !!data.isOwnCompany,
    status: data.status || 'Active'
  };

  try {
    const res = await api.post('/companies', payload);
    const created = res.data?.data || res.data;
    const finalComp = {
      id: created._id || created.id,
      companyName: created.companyName || created.name || payload.companyName,
      code: created.code || payload.code,
      isOwnCompany: created.isOwnCompany !== undefined ? created.isOwnCompany : payload.isOwnCompany,
      status: created.status || payload.status
    };

    const currentList = getStoredCompanies();
    currentList.push(finalComp);
    saveStoredCompanies(currentList);
    return finalComp;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create company.';
    throw new Error(serverMsg);
  }
};

export const updateCompany = async (id, data) => {
  try {
    const res = await api.put(`/companies/${id}`, data);
    const updated = res.data?.data || res.data;
    const currentList = getStoredCompanies();
    const idx = currentList.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...updated };
      saveStoredCompanies(currentList);
    }
    return updated;
  } catch (err) {
    const currentList = getStoredCompanies();
    const idx = currentList.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...data };
      saveStoredCompanies(currentList);
      return currentList[idx];
    }
    return { id, ...data };
  }
};

export const deleteCompany = async (id, companyName = '') => {
  addDeletedCompanyId(id, companyName);
  try {
    await api.delete(`/companies/${id}`);
  } catch (err) {}

  const currentList = getStoredCompanies().filter(c => String(c.id) !== String(id) && c.companyName !== companyName);
  saveStoredCompanies(currentList);
  return { success: true, message: 'Company deleted successfully.' };
};

export const deactivateCompany = async (id) => {
  try {
    const res = await api.put(`/companies/${id}/deactivate`);
    return res.data;
  } catch (err) {
    const currentList = getStoredCompanies();
    const idx = currentList.findIndex(c => String(c.id) === String(id));
    if (idx !== -1) {
      currentList[idx].status = currentList[idx].status === 'Active' ? 'Inactive' : 'Active';
      saveStoredCompanies(currentList);
    }
    return { success: true, message: 'Company status toggled successfully.' };
  }
};

const PRODUCT_GROUP_STORAGE_KEY = 'maitri_local_product_groups';
const DELETED_PRODUCT_GROUPS_KEY = 'maitri_deleted_product_group_ids';

export const normalizeProductGroup = (g) => {
  if (!g) return { id: `PG-${Date.now()}`, groupName: '', groupCode: '', description: '', parentGroup: '', status: 'Active' };
  return {
    id: g._id || g.id || g.group_id || `PG-${Math.floor(Math.random() * 10000)}`,
    groupName: g.groupName || g.group_name || g.name || g.categoryName || g.title || 'Unnamed Group',
    groupCode: g.groupCode || g.group_code || g.code || g.prefix || '',
    description: g.description || g.details || g.desc || '',
    parentGroup: typeof g.parentGroup === 'object' ? (g.parentGroup?.groupName || g.parentGroup?.name || '') : (g.parentGroup || g.parent_group || g.parent || ''),
    status: g.status || (g.isActive === false || g.is_active === false ? 'Inactive' : 'Active')
  };
};

const getDeletedProductGroupIds = () => {
  try {
    const data = localStorage.getItem(DELETED_PRODUCT_GROUPS_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {}
  return [];
};

const addDeletedProductGroupId = (id, name = '') => {
  try {
    const list = getDeletedProductGroupIds();
    if (id && !list.includes(String(id))) list.push(String(id));
    if (name && !list.includes(String(name))) list.push(String(name));
    localStorage.setItem(DELETED_PRODUCT_GROUPS_KEY, JSON.stringify(list));
  } catch (err) {}
};

const getStoredProductGroups = () => {
  try {
    const data = localStorage.getItem(PRODUCT_GROUP_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {}
  return [];
};

const saveStoredProductGroups = (list) => {
  try {
    localStorage.setItem(PRODUCT_GROUP_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {}
};

// --- Module 2: Product Group Master Endpoints ---
export const getProductGroups = async () => {
  const deleted = getDeletedProductGroupIds();
  try {
    const res = await api.get('/product-groups');
    const rawList = extractArray(res.data, ['productGroups', 'product_groups', 'groups', 'categories', 'data', 'items', 'list']);
    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizeProductGroup).filter(g => !deleted.includes(String(g.id)) && !deleted.includes(String(g.groupName)));
      return normalized;
    }
  } catch (err) {}

  const stored = getStoredProductGroups();
  return stored.map(normalizeProductGroup).filter(g => !deleted.includes(String(g.id)) && !deleted.includes(String(g.groupName)));
};

export const createProductGroup = async (data) => {
  try {
    const payload = {
      groupName: data.groupName || data.name,
      group_name: data.groupName || data.name,
      name: data.groupName || data.name,
      groupCode: data.groupCode || data.code || '',
      group_code: data.groupCode || data.code || '',
      code: data.groupCode || data.code || '',
      description: data.description || '',
      parentGroup: data.parentGroup || '',
      parent_group: data.parentGroup || '',
      status: data.status || 'Active',
      isActive: data.status === 'Active',
      is_active: data.status === 'Active'
    };
    const res = await api.post('/product-groups', payload);
    const created = res.data?.data || res.data;
    const finalGroup = normalizeProductGroup(created);

    const currentList = getStoredProductGroups();
    currentList.push(finalGroup);
    saveStoredProductGroups(currentList);
    return finalGroup;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create product group.';
    throw new Error(serverMsg);
  }
};

export const updateProductGroup = async (id, data) => {
  try {
    const payload = {
      groupName: data.groupName || data.name,
      group_name: data.groupName || data.name,
      name: data.groupName || data.name,
      groupCode: data.groupCode || data.code || '',
      group_code: data.groupCode || data.code || '',
      code: data.groupCode || data.code || '',
      description: data.description || '',
      parentGroup: data.parentGroup || '',
      parent_group: data.parentGroup || '',
      status: data.status || 'Active',
      isActive: data.status === 'Active',
      is_active: data.status === 'Active'
    };
    const res = await api.put(`/product-groups/${id}`, payload);
    const updated = res.data?.data || res.data;
    const normalized = normalizeProductGroup(updated);

    const currentList = getStoredProductGroups();
    const idx = currentList.findIndex(g => String(g.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...normalized };
      saveStoredProductGroups(currentList);
    }
    return normalized;
  } catch (err) {
    const currentList = getStoredProductGroups();
    const idx = currentList.findIndex(g => String(g.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...data };
      saveStoredProductGroups(currentList);
      return normalizeProductGroup(currentList[idx]);
    }
    return normalizeProductGroup({ id, ...data });
  }
};

export const deleteProductGroup = async (id, groupName = '') => {
  addDeletedProductGroupId(id, groupName);
  try {
    const res = await api.delete(`/product-groups/${id}`);
    const currentList = getStoredProductGroups().filter(g => String(g.id) !== String(id) && g.groupName !== groupName);
    saveStoredProductGroups(currentList);
    return res.data;
  } catch (err) {}

  const currentList = getStoredProductGroups().filter(g => String(g.id) !== String(id) && g.groupName !== groupName);
  saveStoredProductGroups(currentList);
  return { success: true, message: 'Product group deleted successfully.' };
};

export const deactivateProductGroup = async (id) => {
  try {
    const res = await api.put(`/product-groups/${id}/deactivate`);
    const updated = res.data?.data || res.data;
    const normalized = normalizeProductGroup(updated);

    const currentList = getStoredProductGroups();
    const idx = currentList.findIndex(g => String(g.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...normalized };
      saveStoredProductGroups(currentList);
    }
    return normalized;
  } catch (err) {
    const currentList = getStoredProductGroups();
    const idx = currentList.findIndex(g => String(g.id) === String(id));
    if (idx !== -1) {
      currentList[idx].status = currentList[idx].status === 'Active' ? 'Inactive' : 'Active';
      saveStoredProductGroups(currentList);
      return normalizeProductGroup(currentList[idx]);
    }
    return { success: true, message: 'Product group status updated.' };
  }
};

