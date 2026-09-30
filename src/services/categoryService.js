import api, { extractArray } from './api';

export const DEFAULT_CATEGORIES = [
  { id: 'cat-1', categoryName: 'Sanitaryware', categoryCode: 'SAN', description: 'Water closets, wash basins, urinals and ceramic sanitary items', displayOrder: 1, isActive: true },
  { id: 'cat-2', categoryName: 'Tiles', categoryCode: 'TILE', description: 'Vitrified floor slabs, ceramic wall tiles, parking & elevation tiles', displayOrder: 2, isActive: true },
  { id: 'cat-3', categoryName: 'Faucets', categoryCode: 'FAU', description: 'Basin mixers, sink taps, pillar cocks and brass faucets', displayOrder: 3, isActive: true },
  { id: 'cat-4', categoryName: 'Showers', categoryCode: 'SHW', description: 'Thermostatic diverters, overhead showers, and shower columns', displayOrder: 4, isActive: true },
  { id: 'cat-5', categoryName: 'Wellness', categoryCode: 'WEL', description: 'Freestanding bathtubs, whirlpools, and spa suites', displayOrder: 5, isActive: true },
  { id: 'cat-6', categoryName: 'Allied', categoryCode: 'ALLIED', description: 'Health faucets, angle valves, wastes, bottle traps and plumbing allied', displayOrder: 6, isActive: true },
  { id: 'cat-7', categoryName: 'Bathroom Accessories', categoryCode: 'ACC', description: 'Towel racks, soap dispensers, tumbler holders and rob hooks', displayOrder: 7, isActive: true },
  { id: 'cat-8', categoryName: 'Kitchen Sinks', categoryCode: 'SINK', description: 'Stainless steel and quartz kitchen sinks', displayOrder: 8, isActive: true }
];

export const normalizeCategory = (c) => {
  if (!c) return null;
  const id = c._id || c.id || '';
  const isAct = c.isActive !== undefined ? Boolean(c.isActive) : true;
  return {
    id,
    _id: id,
    categoryName: c.categoryName || c.name || '',
    categoryCode: c.categoryCode || c.code || '',
    description: c.description || '',
    displayOrder: Number(c.displayOrder || 0),
    iconName: c.iconName || '',
    isActive: isAct,
    status: isAct ? 'Active' : 'Inactive',
    createdAt: c.createdAt ? String(c.createdAt).split('T')[0] : ''
  };
};

/**
 * Get list of all product categories
 */
export const getCategories = async (params = {}) => {
  try {
    const res = await api.get('/categories', { params });
    const rawList = extractArray(res.data, ['categories', 'data', 'records']);
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList.map(normalizeCategory).filter(Boolean);
    }
    return DEFAULT_CATEGORIES.map(normalizeCategory);
  } catch (err) {
    console.warn('[CategoryService] Failed to load from backend, using default categories:', err?.message);
    return DEFAULT_CATEGORIES.map(normalizeCategory);
  }
};

/**
 * Get single category by ID
 */
export const getCategoryById = async (id) => {
  if (!id) throw new Error('Category ID is required');
  const res = await api.get(`/categories/${id}`);
  const raw = res.data?.data?.category || res.data?.data || res.data;
  return normalizeCategory(raw);
};

/**
 * Create a new product category
 */
export const createCategory = async (categoryData) => {
  const payload = {
    categoryName: (categoryData.categoryName || categoryData.name || '').trim(),
    categoryCode: categoryData.categoryCode ? categoryData.categoryCode.trim().toUpperCase() : undefined,
    description: categoryData.description ? categoryData.description.trim() : '',
    displayOrder: Number(categoryData.displayOrder || 0),
    isActive: categoryData.status ? categoryData.status === 'Active' : (categoryData.isActive !== false)
  };
  const res = await api.post('/categories', payload);
  const created = res.data?.data?.category || res.data?.data || res.data;
  return normalizeCategory(created);
};

/**
 * Update an existing product category
 */
export const updateCategory = async (id, categoryData) => {
  const payload = {
    categoryName: (categoryData.categoryName || categoryData.name || '').trim(),
    categoryCode: categoryData.categoryCode ? categoryData.categoryCode.trim().toUpperCase() : '',
    description: categoryData.description ? categoryData.description.trim() : '',
    displayOrder: Number(categoryData.displayOrder || 0),
    isActive: categoryData.status ? categoryData.status === 'Active' : Boolean(categoryData.isActive)
  };
  const res = await api.put(`/categories/${id}`, payload);
  const updated = res.data?.data?.category || res.data?.data || res.data;
  return normalizeCategory(updated);
};

/**
 * Soft delete / Deactivate category
 */
export const deactivateCategory = async (id) => {
  const res = await api.put(`/categories/${id}/deactivate`);
  return res.data;
};

/**
 * Delete category
 */
export const deleteCategory = async (id) => {
  const res = await api.delete(`/categories/${id}`);
  return res.data;
};

export default {
  DEFAULT_CATEGORIES,
  normalizeCategory,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
  deleteCategory
};
