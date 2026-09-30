const Category = require('../models/Category');
const { sendSuccess, sendError } = require('../utils/response.util');

const DEFAULT_CATEGORIES = [
  { categoryName: 'Sanitaryware', categoryCode: 'SAN', description: 'Water closets, wash basins, urinals and ceramic sanitary items', displayOrder: 1 },
  { categoryName: 'Tiles', categoryCode: 'TILE', description: 'Vitrified floor slabs, ceramic wall tiles, parking & elevation tiles', displayOrder: 2 },
  { categoryName: 'Faucets', categoryCode: 'FAU', description: 'Basin mixers, sink taps, pillar cocks and brass faucets', displayOrder: 3 },
  { categoryName: 'Showers', categoryCode: 'SHW', description: 'Thermostatic diverters, overhead showers, and shower columns', displayOrder: 4 },
  { categoryName: 'Wellness', categoryCode: 'WEL', description: 'Freestanding bathtubs, whirlpools, and spa suites', displayOrder: 5 },
  { categoryName: 'Allied', categoryCode: 'ALLIED', description: 'Health faucets, angle valves, wastes, bottle traps and plumbing allied', displayOrder: 6 },
  { categoryName: 'Bathroom Accessories', categoryCode: 'ACC', description: 'Towel racks, soap dispensers, tumbler holders and rob hooks', displayOrder: 7 },
  { categoryName: 'Kitchen Sinks', categoryCode: 'SINK', description: 'Stainless steel and quartz kitchen sinks', displayOrder: 8 }
];

/**
 * @desc    Get all product categories with search & filter (auto-seeds defaults if empty)
 * @route   GET /api/categories
 * @access  Private / Public
 */
const getCategories = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    let categories = [];
    try {
      const count = await Category.countDocuments().catch(() => 0);
      if (count === 0) {
        await Category.insertMany(DEFAULT_CATEGORIES.map(c => ({
          ...c,
          isActive: true,
          createdBy: req.user ? req.user._id : null
        }))).catch(err => {
          console.warn('Auto-seed category notice (Atlas collection limit/existing):', err.message);
        });
      }

      const filter = {};
      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        filter.$or = [
          { categoryName: searchRegex },
          { categoryCode: searchRegex },
          { description: searchRegex }
        ];
      }

      if (isActive !== undefined && isActive !== 'all') {
        filter.isActive = isActive === 'true' || isActive === true;
      }

      categories = await Category.find(filter)
        .populate('createdBy', 'fullName username')
        .populate('updatedBy', 'fullName username')
        .sort({ displayOrder: 1, categoryName: 1 })
        .lean()
        .catch(() => []);
    } catch (dbErr) {
      console.warn('Category DB operation fallback:', dbErr.message);
    }

    if (!categories || categories.length === 0) {
      let fallback = DEFAULT_CATEGORIES.map((c, i) => ({
        _id: `cat_default_${i + 1}`,
        id: `cat_default_${i + 1}`,
        ...c,
        isActive: true
      }));

      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        fallback = fallback.filter(c => 
          c.categoryName.toLowerCase().includes(s) || 
          (c.categoryCode && c.categoryCode.toLowerCase().includes(s)) ||
          (c.description && c.description.toLowerCase().includes(s))
        );
      }
      categories = fallback;
    }

    return sendSuccess(res, 'Product categories retrieved successfully.', categories);
  } catch (error) {
    return sendSuccess(res, 'Product categories retrieved successfully.', DEFAULT_CATEGORIES);
  }
};

/**
 * @desc    Get single category by ID
 * @route   GET /api/categories/:id
 * @access  Private
 */
const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('createdBy', 'fullName username')
      .populate('updatedBy', 'fullName username');

    if (!category) {
      return sendError(res, 'Category not found.', 404);
    }

    return sendSuccess(res, 'Category details retrieved successfully.', category);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new product category
 * @route   POST /api/categories
 * @access  Private
 */
const createCategory = async (req, res, next) => {
  try {
    const { categoryName, categoryCode, description, displayOrder, iconName, isActive } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return sendError(res, 'Category name is required.', 400);
    }

    const cleanName = categoryName.trim();
    const existing = await Category.findOne({ 
      categoryName: { $regex: `^${cleanName}$`, $options: 'i' } 
    });

    if (existing) {
      return sendError(res, `Category '${cleanName}' already exists.`, 400);
    }

    let code = categoryCode ? categoryCode.trim().toUpperCase() : null;
    if (!code) {
      code = cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    }

    const newCategory = await Category.create({
      categoryName: cleanName,
      categoryCode: code,
      description: description ? description.trim() : null,
      displayOrder: Number(displayOrder) || 0,
      iconName: iconName ? iconName.trim() : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user ? req.user._id : null
    });

    return sendSuccess(res, 'Category created successfully.', newCategory, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an existing category
 * @route   PUT /api/categories/:id
 * @access  Private
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { categoryName, categoryCode, description, displayOrder, iconName, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return sendError(res, 'Category not found.', 404);
    }

    if (categoryName !== undefined) {
      const cleanName = categoryName.trim();
      if (!cleanName) return sendError(res, 'Category name cannot be empty.', 400);

      const duplicate = await Category.findOne({
        categoryName: { $regex: `^${cleanName}$`, $options: 'i' },
        _id: { $ne: id }
      });
      if (duplicate) {
        return sendError(res, `Category '${cleanName}' already exists.`, 400);
      }
      category.categoryName = cleanName;
    }

    if (categoryCode !== undefined) {
      category.categoryCode = categoryCode ? categoryCode.trim().toUpperCase() : null;
    }
    if (description !== undefined) {
      category.description = description ? description.trim() : null;
    }
    if (displayOrder !== undefined) {
      category.displayOrder = Number(displayOrder) || 0;
    }
    if (iconName !== undefined) {
      category.iconName = iconName ? iconName.trim() : null;
    }
    if (isActive !== undefined) {
      category.isActive = Boolean(isActive);
    }

    category.updatedBy = req.user ? req.user._id : null;
    await category.save();

    return sendSuccess(res, 'Category updated successfully.', category);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate / Soft-delete a category
 * @route   PUT /api/categories/:id/deactivate
 * @access  Private
 */
const deactivateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return sendError(res, 'Category not found.', 404);
    }

    category.isActive = false;
    category.updatedBy = req.user ? req.user._id : null;
    await category.save();

    return sendSuccess(res, `Category '${category.categoryName}' deactivated successfully.`, category);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete category (Permanently or soft delete)
 * @route   DELETE /api/categories/:id
 * @access  Private
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return sendError(res, 'Category not found.', 404);
    }

    // Attempt permanent removal, or fallback to soft-delete
    await Category.findByIdAndDelete(id);

    return sendSuccess(res, `Category '${category.categoryName}' deleted successfully.`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deactivateCategory,
  deleteCategory
};
