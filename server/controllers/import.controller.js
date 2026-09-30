const ImportBatch = require('../models/ImportBatch');
const ImportFieldMapping = require('../models/ImportFieldMapping');
const { uploadToCloudinary } = require('../config/cloudinary');
const { parseExcelBuffer } = require('../services/excelParser.service');
const { parsePdfBuffer } = require('../services/pdfParser.service');
const { simulatePreview, executeCommit, generateErrorReport } = require('../services/import.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Upload Excel file, upload to Cloudinary & simulate preview
 * @route   POST /api/imports/excel/preview
 * @access  checkPermission('PRODUCT_IMPORT', 'create')
 */
const previewExcel = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, 'Please upload an Excel file (.xlsx, .xls, .csv).', 400);
    }

    // 1. Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'maitri-ceramic/imports/excel',
      'raw'
    );

    // 2. Parse Excel
    const parsed = parseExcelBuffer(req.file.buffer);

    // 3. Check for matching saved field mapping profile
    const savedMapping = await ImportFieldMapping.findOne({
      headerSignature: parsed.headerSignature,
      sourceType: 'EXCEL',
      isActive: true
    });

    const activeMapping = savedMapping ? savedMapping.mapping : parsed.suggestedMapping;

    // 4. Run non-destructive preview simulation
    const previewRows = await simulatePreview(parsed.rows, activeMapping);

    // 5. Create ImportBatch in PREVIEWED state
    const batch = await ImportBatch.create({
      sourceType: 'EXCEL',
      originalFileName: req.file.originalname,
      fileUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      status: 'PREVIEWED',
      headerSignature: parsed.headerSignature,
      fieldMappingUsed: activeMapping,
      totalRows: parsed.rows.length,
      cachedRows: parsed.rows,
      uploadedBy: req.user._id
    });

    return sendSuccess(res, 'Excel parsed and preview generated successfully (Zero database writes).', {
      importBatchId: batch._id,
      fileUrl: cloudinaryResult.secure_url,
      originalFileName: req.file.originalname,
      headerSignature: parsed.headerSignature,
      suggestedMapping: activeMapping,
      isSavedMappingUsed: Boolean(savedMapping),
      savedMappingName: savedMapping ? savedMapping.mappingName : null,
      totalRows: parsed.rows.length,
      previewRows: previewRows.slice(0, 100), // Return first 100 preview rows
      hasMoreRows: parsed.rows.length > 100
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Commit Excel import batch
 * @route   POST /api/imports/excel/commit
 * @access  checkPermission('PRODUCT_IMPORT', 'create') AND checkPermission('PRODUCT_MASTER', 'create')
 */
const commitExcel = async (req, res, next) => {
  try {
    const { importBatchId, fieldMapping, saveMappingAs } = req.body;

    if (!importBatchId) {
      return sendError(res, 'importBatchId is required.', 400);
    }

    if (!fieldMapping || typeof fieldMapping !== 'object') {
      return sendError(res, 'fieldMapping definition object is required.', 400);
    }

    const batch = await ImportBatch.findById(importBatchId);
    if (!batch) {
      return sendError(res, 'Import batch not found.', 404);
    }

    // Optionally save mapping profile for future auto-match
    if (saveMappingAs && String(saveMappingAs).trim()) {
      await ImportFieldMapping.findOneAndUpdate(
        { headerSignature: batch.headerSignature, sourceType: 'EXCEL' },
        {
          $set: {
            mappingName: String(saveMappingAs).trim(),
            mapping: fieldMapping,
            createdBy: req.user._id,
            isActive: true
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const result = await executeCommit(importBatchId, fieldMapping, req.user._id);

    return sendSuccess(res, `Excel import committed with status: ${result.status}`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload PDF catalog, upload to Cloudinary & simulate preview / extraction
 * @route   POST /api/imports/pdf/preview
 * @access  checkPermission('PRODUCT_IMPORT', 'create')
 */
const previewPdf = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, 'Please upload a PDF file (.pdf).', 400);
    }

    // 1. Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'maitri-ceramic/imports/pdf',
      'raw'
    );

    // 2. Parse PDF
    const parsed = await parsePdfBuffer(req.file.buffer);

    if (!parsed.isStructured) {
      const failedBatch = await ImportBatch.create({
        sourceType: 'PDF',
        originalFileName: req.file.originalname,
        fileUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        status: 'EXTRACTION_FAILED',
        uploadedBy: req.user._id
      });

      return sendError(
        res,
        parsed.message || 'PDF is unstructured or contains scanned images. Automated extraction is not supported.',
        400,
        {
          importBatchId: failedBatch._id,
          fileUrl: cloudinaryResult.secure_url,
          status: 'EXTRACTION_FAILED'
        }
      );
    }

    // 3. Check for matching saved mapping
    const savedMapping = await ImportFieldMapping.findOne({
      headerSignature: parsed.headerSignature,
      sourceType: 'PDF',
      isActive: true
    });

    const activeMapping = savedMapping ? savedMapping.mapping : parsed.suggestedMapping;

    // 4. Run preview simulation
    const previewRows = await simulatePreview(parsed.rows, activeMapping);

    // 5. Create ImportBatch
    const batch = await ImportBatch.create({
      sourceType: 'PDF',
      originalFileName: req.file.originalname,
      fileUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      status: 'PREVIEWED',
      headerSignature: parsed.headerSignature,
      fieldMappingUsed: activeMapping,
      totalRows: parsed.rows.length,
      cachedRows: parsed.rows,
      uploadedBy: req.user._id
    });

    return sendSuccess(res, 'PDF tabular data extracted and preview generated successfully.', {
      importBatchId: batch._id,
      fileUrl: cloudinaryResult.secure_url,
      originalFileName: req.file.originalname,
      headerSignature: parsed.headerSignature,
      suggestedMapping: activeMapping,
      isSavedMappingUsed: Boolean(savedMapping),
      totalRows: parsed.rows.length,
      previewRows: previewRows.slice(0, 100)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Commit PDF import batch
 * @route   POST /api/imports/pdf/commit
 * @access  checkPermission('PRODUCT_IMPORT', 'create') AND checkPermission('PRODUCT_MASTER', 'create')
 */
const commitPdf = async (req, res, next) => {
  try {
    const { importBatchId, fieldMapping, saveMappingAs } = req.body;

    if (!importBatchId) {
      return sendError(res, 'importBatchId is required.', 400);
    }

    if (!fieldMapping || typeof fieldMapping !== 'object') {
      return sendError(res, 'fieldMapping definition object is required.', 400);
    }

    const batch = await ImportBatch.findById(importBatchId);
    if (!batch) {
      return sendError(res, 'Import batch not found.', 404);
    }

    if (saveMappingAs && String(saveMappingAs).trim()) {
      await ImportFieldMapping.findOneAndUpdate(
        { headerSignature: batch.headerSignature, sourceType: 'PDF' },
        {
          $set: {
            mappingName: String(saveMappingAs).trim(),
            mapping: fieldMapping,
            createdBy: req.user._id,
            isActive: true
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const result = await executeCommit(importBatchId, fieldMapping, req.user._id);

    return sendSuccess(res, `PDF import committed with status: ${result.status}`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download Excel error report of failed rows for an import batch
 * @route   GET /api/imports/:id/error-report
 * @access  checkPermission('PRODUCT_IMPORT', 'export')
 */
const downloadErrorReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const batch = await ImportBatch.findById(id);
    if (!batch) {
      return sendError(res, 'Import batch not found.', 404);
    }

    if (!batch.errors || batch.errors.length === 0) {
      return sendError(res, 'This import batch has zero errors. No error report to generate.', 400);
    }

    const excelBuffer = generateErrorReport(batch);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Import_Errors_${id}.xlsx`);
    return res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get import history with filtering & pagination
 * @route   GET /api/imports
 * @access  checkPermission('PRODUCT_IMPORT', 'view')
 */
const getImportHistory = async (req, res, next) => {
  try {
    const { status, sourceType, from, to, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (sourceType) filter.sourceType = sourceType;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [batches, total] = await Promise.all([
      ImportBatch.find(filter)
        .populate('uploadedBy', 'name mobile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ImportBatch.countDocuments(filter)
    ]);

    return sendSuccess(res, 'Import history retrieved successfully.', {
      batches,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single import batch details
 * @route   GET /api/imports/:id
 * @access  checkPermission('PRODUCT_IMPORT', 'view')
 */
const getImportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const batch = await ImportBatch.findById(id).populate('uploadedBy', 'name mobile');
    if (!batch) {
      return sendError(res, 'Import batch not found.', 404);
    }

    return sendSuccess(res, 'Import batch retrieved successfully.', batch);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get saved field mapping profiles
 * @route   GET /api/imports/mappings
 * @access  checkPermission('PRODUCT_IMPORT', 'view')
 */
const getFieldMappings = async (req, res, next) => {
  try {
    const mappings = await ImportFieldMapping.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 'Saved field mappings retrieved successfully.', mappings);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a saved field mapping profile
 * @route   POST /api/imports/mappings
 * @access  checkPermission('PRODUCT_IMPORT', 'create')
 */
const saveFieldMapping = async (req, res, next) => {
  try {
    const { mappingName, sourceType, headerSignature, mapping } = req.body;

    if (!mappingName || !sourceType || !headerSignature || !mapping) {
      return sendError(res, 'mappingName, sourceType, headerSignature, and mapping are required.', 400);
    }

    const saved = await ImportFieldMapping.findOneAndUpdate(
      { headerSignature, sourceType },
      {
        $set: {
          mappingName: mappingName.trim(),
          mapping,
          createdBy: req.user._id,
          isActive: true
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, 'Field mapping profile saved successfully.', saved, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a saved field mapping profile
 * @route   DELETE /api/imports/mappings/:id
 * @access  checkPermission('PRODUCT_IMPORT', 'delete')
 */
const deleteFieldMapping = async (req, res, next) => {
  try {
    const { id } = req.params;

    const mapping = await ImportFieldMapping.findById(id);
    if (!mapping) {
      return sendError(res, 'Field mapping profile not found.', 404);
    }

    mapping.isActive = false;
    await mapping.save();

    return sendSuccess(res, 'Field mapping profile deleted successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  previewExcel,
  commitExcel,
  previewPdf,
  commitPdf,
  downloadErrorReport,
  getImportHistory,
  getImportById,
  getFieldMappings,
  saveFieldMapping,
  deleteFieldMapping
};
