import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getCustomers, getCustomerById } from '../services/customerService';
import { getInvoiceableChallans, createInvoice } from '../services/invoiceService';
import { getQuotationById } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { 
  ArrowLeft, 
  FileText, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  CheckSquare, 
  Square,
  Building2,
  Phone,
  MapPin,
  Calendar,
  User,
  ExternalLink,
  Plus,
  Receipt
} from 'lucide-react';

export const CreateInvoice = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId') || '';
  const preselectedQuotationId = searchParams.get('quotationId') || '';
  const preselectedChallanId = searchParams.get('challanId') || '';

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoiceableChallans, setInvoiceableChallans] = useState([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedChallanIds, setSelectedChallanIds] = useState(preselectedChallanId ? [preselectedChallanId] : []);
  const [isChangingCustomer, setIsChangingCustomer] = useState(false);

  const [formData, setFormData] = useState({
    buyerBillTo: '',
    consigneeShipTo: '',
    refNumber: '',
    deliveryNote: '',
    termsOfPayment: 'Net 30 Days',
    termsOfDelivery: 'Door delivery / Site delivery'
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Helper to fill customer bill-to and ship-to
  const fillCustomerDetails = (cust, challan, quotNum = '') => {
    const c = cust || {};
    const name = c.customerName || c.name || 'Customer';
    const billTo = c.billingAddress 
      ? `${name}, ${c.billingAddress}, ${c.city || ''} (GSTIN: ${c.gstNumber || 'N/A'})`
      : (c.address || `${name}, ${c.city || ''}`);
    const shipTo = c.shippingAddress || c.billingAddress || challan?.deliveryDetails || c.city || '';

    setFormData(prev => ({
      ...prev,
      buyerBillTo: billTo,
      consigneeShipTo: shipTo,
      refNumber: quotNum || challan?.quotationNumber || challan?.refQuotationNo || prev.refNumber || '',
      deliveryNote: challan?.deliveryDetails || prev.deliveryNote || ''
    }));
  };

  // Initial Data Loading
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [challansRes, customersRes] = await Promise.all([
          getInvoiceableChallans(),
          getCustomers({ limit: 1000 })
        ]);

        const challanList = Array.isArray(challansRes) ? challansRes : [];
        const customerList = customersRes.data || [];
        setInvoiceableChallans(challanList);
        setCustomers(customerList);

        let targetCustId = preselectedCustomerId;
        let matchedCustomer = null;

        // 1. If preselected customer ID is provided in URL
        if (targetCustId) {
          matchedCustomer = customerList.find(c => String(c.id || c._id) === String(targetCustId));
          if (!matchedCustomer) {
            try {
              matchedCustomer = await getCustomerById(targetCustId);
            } catch (e) {
              console.warn('Could not fetch preselected customer by ID:', e);
            }
          }
        } 
        // 2. If preselected challan ID is provided in URL
        else if (preselectedChallanId) {
          const matchedChallan = challanList.find(c => String(c._id || c.id) === String(preselectedChallanId));
          if (matchedChallan) {
            const custId = matchedChallan.customer?._id || matchedChallan.customer?.id || matchedChallan.customer || matchedChallan.customerId;
            if (custId) {
              targetCustId = String(custId);
              matchedCustomer = matchedChallan.customer || customerList.find(c => String(c.id || c._id) === String(targetCustId));
            }
          }
        }

        // Apply customer selection if resolved
        if (targetCustId && matchedCustomer) {
          setSelectedCustomerId(String(targetCustId));
          setSelectedCustomer(matchedCustomer);

          // Find challans for this customer
          const custChallans = challanList.filter(ch => {
            const cId = ch.customer?._id || ch.customer?.id || ch.customerId;
            return String(cId) === String(targetCustId);
          });

          // Check for specific quotation / challan matching
          let quotationRef = '';
          if (preselectedQuotationId) {
            try {
              const qData = await getQuotationById(preselectedQuotationId);
              if (qData) quotationRef = qData.quotationNumber || '';
            } catch (err) {
              console.warn('Quotation lookup notice:', err);
            }
          }

          if (preselectedChallanId) {
            setSelectedChallanIds([String(preselectedChallanId)]);
            const ch = custChallans.find(c => String(c._id || c.id) === String(preselectedChallanId));
            fillCustomerDetails(matchedCustomer, ch, quotationRef);
          } else if (custChallans.length > 0) {
            // Auto-select all available challans for this customer
            setSelectedChallanIds(custChallans.map(c => String(c._id || c.id)));
            fillCustomerDetails(matchedCustomer, custChallans[0], quotationRef);
          } else {
            setSelectedChallanIds([]);
            fillCustomerDetails(matchedCustomer, null, quotationRef);
          }
        }
      } catch (err) {
        console.error('Failed to load initial billing data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [preselectedCustomerId, preselectedChallanId, preselectedQuotationId]);

  // All customers with their eligible challan count
  const customersWithChallanStats = useMemo(() => {
    return customers.map(cust => {
      const cId = String(cust.id || cust._id);
      const readyChallans = invoiceableChallans.filter(ch => {
        const challanCustId = String(ch.customer?._id || ch.customer?.id || ch.customerId);
        return challanCustId === cId;
      });
      return {
        ...cust,
        cId,
        challanCount: readyChallans.length
      };
    });
  }, [customers, invoiceableChallans]);

  // Challans matching the currently selected customer
  const availableChallansForCustomer = useMemo(() => {
    if (!selectedCustomerId) return [];
    return invoiceableChallans.filter(ch => {
      const cId = ch.customer?._id || ch.customer?.id || ch.customerId;
      return String(cId) === String(selectedCustomerId);
    });
  }, [invoiceableChallans, selectedCustomerId]);

  const handleCustomerChange = (e) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    setIsChangingCustomer(false);
    setFormError('');

    if (!custId) {
      setSelectedCustomer(null);
      setSelectedChallanIds([]);
      setFormData(prev => ({ ...prev, buyerBillTo: '', consigneeShipTo: '', refNumber: '' }));
      return;
    }

    const custObj = customers.find(c => String(c.id || c._id) === String(custId));
    setSelectedCustomer(custObj || null);

    const matching = invoiceableChallans.filter(ch => {
      const cId = ch.customer?._id || ch.customer?.id || ch.customerId;
      return String(cId) === String(custId);
    });

    if (matching.length > 0) {
      setSelectedChallanIds(matching.map(c => String(c._id || c.id)));
      fillCustomerDetails(custObj || matching[0].customer, matching[0]);
    } else {
      setSelectedChallanIds([]);
      if (custObj) fillCustomerDetails(custObj, null);
    }
  };

  const handleToggleChallan = (challanId) => {
    setFormError('');
    setSelectedChallanIds(prev => {
      if (prev.includes(challanId)) {
        return prev.filter(id => id !== challanId);
      } else {
        return [...prev, challanId];
      }
    });
  };

  // Aggregated items from all selected challans
  const aggregatedItems = useMemo(() => {
    const items = [];
    selectedChallanIds.forEach(chId => {
      const ch = invoiceableChallans.find(c => String(c._id || c.id) === String(chId));
      if (ch && Array.isArray(ch.items)) {
        ch.items.forEach(item => {
          items.push({
            challanNo: ch.challanNumber,
            sku: item.skuCodeSnapshot || item.product?.companySkuCode || item.sku || 'SKU',
            productName: item.productNameSnapshot || item.product?.productName || item.productName || 'Product',
            quantity: Number(item.quantityToIssue != null ? item.quantityToIssue : (item.quantity || 0)),
            unit: item.unit?.unitName || item.unit?.unitCode || (typeof item.unit === 'string' && item.unit.length <= 10 ? item.unit : 'Boxes') || 'Pcs',
            remarks: item.remarks || ''
          });
        });
      }
    });
    return items;
  }, [selectedChallanIds, invoiceableChallans]);

  const totalQuantity = useMemo(() => {
    return aggregatedItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }, [aggregatedItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedCustomerId) {
      setFormError('Please select a customer.');
      return;
    }

    if (selectedChallanIds.length === 0) {
      setFormError('At least one finalized Delivery Challan is required to issue a Tax Invoice.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        challanIds: selectedChallanIds,
        buyerBillTo: formData.buyerBillTo.trim(),
        consigneeShipTo: formData.consigneeShipTo.trim(),
        referenceNumber: formData.refNumber.trim() || undefined,
        deliveryNote: formData.deliveryNote.trim() || undefined,
        termsOfPayment: formData.termsOfPayment.trim() || undefined,
        termsOfDelivery: formData.termsOfDelivery.trim() || undefined
      };

      const created = await createInvoice(payload);
      setSuccessToast(`Tax Invoice ${created?.invoiceNumber || 'INV'} generated & issued successfully!`);

      setTimeout(() => {
        navigate(selectedCustomerId ? `/customers/${selectedCustomerId}?tab=invoices` : '/customers');
      }, 900);
    } catch (err) {
      console.error('Error generating invoice:', err);
      const msg = err.response?.data?.message || err.message || 'Error generating tax invoice from backend.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const activeCustomerDisplay = selectedCustomer || 
    customers.find(c => String(c.id || c._id) === String(selectedCustomerId)) || 
    (availableChallansForCustomer[0]?.customer) || null;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '3.5rem', fontFamily: 'var(--font-family)' }}>
      {/* Toast Notification */}
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
          fontWeight: 600
        }}>
          <CheckCircle2 size={22} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to={selectedCustomerId ? `/customers/${selectedCustomerId}?tab=invoices` : '/customers'} 
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '8px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Invoices</span>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Generate Tax Invoice
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.2rem 0 0 0' }}>
              Multi-Challan Consolidation & Server-Computed GST Billing
            </p>
          </div>
        </div>
      </div>

      {formError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '0.9rem',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
          <div>{formError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Card 1: Selected Customer Header & Challans */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                <Building2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  1. Customer & Delivery Challans
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Consolidate finalized delivery dispatches into one Tax Invoice
                </p>
              </div>
            </div>

            {activeCustomerDisplay && !isChangingCustomer && (
              <button 
                type="button" 
                onClick={() => setIsChangingCustomer(true)} 
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
              >
                Change Customer
              </button>
            )}
          </div>

          {/* If Customer is selected and user is not in change mode -> Show Clean Preselected Customer Box */}
          {activeCustomerDisplay && !isChangingCustomer ? (
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '0.15rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                    Selected Customer
                  </span>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {activeCustomerDisplay.customerName || activeCustomerDisplay.name}
                  </h4>
                </div>

                <div style={{ fontSize: '0.825rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                  <span><strong>Mobile:</strong> {activeCustomerDisplay.mobile || '-'}</span>
                  <span><strong>City:</strong> {activeCustomerDisplay.city || 'Ahmedabad'}</span>
                  <span><strong>GSTIN:</strong> {activeCustomerDisplay.gstNumber || 'Unregistered'}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: availableChallansForCustomer.length > 0 ? '#16a34a' : '#d97706',
                  backgroundColor: availableChallansForCustomer.length > 0 ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${availableChallansForCustomer.length > 0 ? '#bbf7d0' : '#fef3c7'}`,
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  display: 'inline-block'
                }}>
                  {availableChallansForCustomer.length} {availableChallansForCustomer.length === 1 ? 'Challan Ready' : 'Challans Ready'}
                </span>
              </div>
            </div>
          ) : (
            /* Otherwise show Customer Dropdown Selector */
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                Select Customer <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={selectedCustomerId}
                onChange={handleCustomerChange}
                disabled={loading}
                style={{
                  height: '44px',
                  borderRadius: '8px',
                  borderColor: '#cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }}
              >
                <option value="">-- Choose Customer --</option>
                {customersWithChallanStats.map(cust => (
                  <option key={cust.cId} value={cust.cId}>
                    {cust.name || cust.customerName} {cust.city ? `(${cust.city})` : ''} — {cust.challanCount > 0 ? `${cust.challanCount} Challan(s) Ready` : 'No Challans'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Available Challans Section */}
          {selectedCustomerId && (
            <div>
              {availableChallansForCustomer.length > 0 ? (
                <div>
                  <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
                    Select Delivery Challans to Consolidate into this Invoice:
                  </label>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {availableChallansForCustomer.map(ch => {
                      const chId = String(ch._id || ch.id);
                      const isChecked = selectedChallanIds.includes(chId);
                      const itemsCount = ch.items?.length || 0;
                      const totalQty = ch.items?.reduce((s, i) => s + Number(i.quantityToIssue || i.quantity || 0), 0) || 0;

                      return (
                        <div 
                          key={chId}
                          onClick={() => handleToggleChallan(chId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1.15rem',
                            borderRadius: '8px',
                            border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                            backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ color: isChecked ? '#2563eb' : '#94a3b8' }}>
                              {isChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                                {ch.challanNumber}
                                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                  FINALIZED
                                </span>
                              </div>
                              <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.2rem' }}>
                                Date: {formatDate(ch.challanDate)} | Ref: {ch.quotationNumber || ch.refQuotationNo || 'Quotation'} | {ch.deliveryDetails || 'Direct Delivery'}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                            <strong style={{ color: '#2563eb' }}>{itemsCount}</strong> items ({totalQty} Qty)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Prompt if no finalized challans found for this customer */
                <div style={{
                  padding: '1.25rem 1.5rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Truck size={24} style={{ color: '#d97706', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
                        No Finalized Delivery Challans Found for this Customer
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.15rem' }}>
                        Invoices are generated against finalized delivery challans (Module 9). Create a delivery challan first.
                      </div>
                    </div>
                  </div>

                  <Link 
                    to={`/challans/create?customerId=${selectedCustomerId}${preselectedQuotationId ? `&quotationId=${preselectedQuotationId}` : ''}`}
                    className="btn btn-primary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: '#d97706',
                      borderColor: '#d97706'
                    }}
                  >
                    <Plus size={15} /> Create Delivery Challan
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Consolidated Line Items Preview */}
        {selectedChallanIds.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    2. Consolidated Line Items ({aggregatedItems.length})
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                    Backend calculates pricing, discounts and server GST from confirmed order records
                  </p>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                Total Quantity: <span style={{ color: '#2563eb' }}>{totalQuantity}</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '45px' }}>#</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', width: '150px' }}>Source Challan</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '130px' }}>SKU</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '240px' }}>Product Description</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '110px' }}>Quantity</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '90px' }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#2563eb' }}>{item.challanNo}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>{item.sku}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>{item.productName}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{item.quantity}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Card 3: Billing & Consignee Details */}
        {selectedChallanIds.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Truck size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  3. Invoice Terms & Delivery Details
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Bill-to, Ship-to, and Payment Terms for printed GST invoice
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Buyer (Bill To) Address & GSTIN <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={formData.buyerBillTo}
                  onChange={(e) => setFormData({ ...formData, buyerBillTo: e.target.value })}
                  required
                  placeholder="Legal buyer billing name, full address, and GSTIN"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Consignee (Ship To) Destination <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={formData.consigneeShipTo}
                  onChange={(e) => setFormData({ ...formData, consigneeShipTo: e.target.value })}
                  required
                  placeholder="Project site delivery destination"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Ref Quotation / Order
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.refNumber}
                  onChange={(e) => setFormData({ ...formData, refNumber: e.target.value })}
                  placeholder="e.g. Q-2026-27-0039"
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Terms of Payment
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.termsOfPayment}
                  onChange={(e) => setFormData({ ...formData, termsOfPayment: e.target.value })}
                  placeholder="e.g. Net 30 Days"
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Terms of Delivery
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.termsOfDelivery}
                  onChange={(e) => setFormData({ ...formData, termsOfDelivery: e.target.value })}
                  placeholder="e.g. Door delivery / FOR Site"
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        {selectedChallanIds.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
          }}>
            <Link
              to={selectedCustomerId ? `/customers/${selectedCustomerId}?tab=invoices` : '/invoices'}
              className="btn btn-secondary"
              style={{ borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                borderRadius: '8px',
                padding: '0.65rem 1.75rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
            >
              {saving ? <RefreshCw size={16} className="spin-animation" /> : <ShieldCheck size={18} />}
              <span>Generate Tax Invoice</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateInvoice;
