// Business Calculation logic required by Maitri Ceramic Documentation

// Calculate Stock parameters
export const calculateStockMetrics = (previousStock = 0, stockIn = 0, stockIssuedChallan = 0, confirmedQuotationQty = 0, deliveredQty = 0, reorderLevel = 0) => {
  // Actual Stock = Previous Stock + Stock In - Stock Issued Through Challan
  const actualStock = Math.max(0, Number(previousStock) + Number(stockIn) - Number(stockIssuedChallan));
  
  // Management Stock = Confirmed Quotation Quantity - Delivered Quantity
  const managementStock = Math.max(0, Number(confirmedQuotationQty) - Number(deliveredQty));
  
  // Available Stock = Actual Stock - Management Stock
  const availableStock = Math.max(0, actualStock - managementStock);
  
  // Purchase Required when Available Stock < Reorder Level
  const purchaseRequired = availableStock < Number(reorderLevel);

  return {
    actualStock,
    managementStock,
    availableStock,
    purchaseRequired,
    isLowStock: actualStock <= Number(reorderLevel)
  };
};

// Calculate Quotation Line Item
export const calculateQuotationItem = (item) => {
  const quantity = Number(item.quantity || 0);
  const rate = Number(item.rate || 0);
  const discountPercent = Number(item.discountPercent || 0);
  const gstPercent = Number(item.gstPercent || 18);

  const grossAmount = rate * quantity;
  const discountAmount = (grossAmount * discountPercent) / 100;
  const taxableAmount = grossAmount - discountAmount;
  const gstAmount = (taxableAmount * gstPercent) / 100;
  const netAmount = taxableAmount + gstAmount;

  return {
    ...item,
    grossAmount: Number(grossAmount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    netAmount: Number(netAmount.toFixed(2))
  };
};

// Calculate Quotation Totals
export const calculateQuotationTotals = (items = []) => {
  return items.reduce((acc, item) => {
    const calc = calculateQuotationItem(item);
    acc.grossTotal += calc.grossAmount;
    acc.discountTotal += calc.discountAmount;
    acc.taxableTotal += calc.taxableAmount;
    acc.gstTotal += calc.gstAmount;
    acc.finalTotal += calc.netAmount;
    return acc;
  }, {
    grossTotal: 0,
    discountTotal: 0,
    taxableTotal: 0,
    gstTotal: 0,
    finalTotal: 0
  });
};

// Customer Outstanding calculation: Invoice Amount - Payment Received = Outstanding
export const calculateOutstanding = (totalInvoiced = 0, totalPaid = 0) => {
  return Math.max(0, Number(totalInvoiced) - Number(totalPaid));
};
