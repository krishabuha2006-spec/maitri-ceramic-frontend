const XLSX = require('xlsx');

/**
 * Generate Excel workbook buffer for Customer Export
 *
 * @param {Array<Object>} customers - List of customer documents
 * @returns {Buffer}
 */
const exportCustomersToExcel = (customers) => {
  const exportData = (customers || []).map((c, idx) => ({
    'Sr. No.': idx + 1,
    'Customer Name': c.customerName || '',
    'Mobile Number': c.mobile || '',
    'Alternate Number': c.alternateNumber || '',
    'Email': c.email || '',
    'Customer Type': c.customerType || 'RETAIL',
    'Reference / Source': c.reference || c.referenceBy || '',
    'GST Number': c.gstNumber || '',
    'City': c.city || '',
    'State': c.state || '',
    'Billing Address': c.billingAddress || '',
    'Shipping Address': c.shippingAddress || '',
    'Notes': c.notes || '',
    'Status': c.isActive ? 'Active' : 'Inactive',
    'Created At': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  exportCustomersToExcel
};
