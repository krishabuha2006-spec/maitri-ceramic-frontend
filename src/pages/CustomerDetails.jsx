import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCustomerById, saveStoredCustomers } from '../services/customerService';
import { getQuotations, confirmQuotation, cancelQuotation, updateQuotationStatus, exportQuotationDocument } from '../services/quotationService';
import { getChallans, getChallanById } from '../services/challanService';
import { getInvoices } from '../services/invoiceService';
import { getPayments } from '../services/paymentService';
import { getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, COMMUNICATION_TYPES, RESULTING_STATUSES } from '../services/followUpService';
import { getReturns } from '../services/returnService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  ArrowLeft, Edit, Phone, Mail, MapPin, FileCheck, Plus,
  FileText, PhoneCall, Truck, Receipt, CreditCard, RotateCcw,
  BookOpen, ShoppingBag, Eye, Download, CheckCircle2, MessageSquare,
  Calendar, UserCheck, AlertCircle, Clock, ExternalLink, Printer,
  CheckSquare, Check, X, XCircle, RefreshCw, Sliders, Ban, Trash2,
  Package, ShieldCheck, Building2
} from 'lucide-react';
import { usePermissions } from '../utils/permissions';

const getSafeMode = (val, fallback = 'Bank Transfer') => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.modeName === 'string') return val.modeName;
    if (typeof val.modeName === 'object' && val.modeName !== null) return getSafeMode(val.modeName, fallback);
    if (typeof val.name === 'string') return val.name;
    if (typeof val.mode === 'string') return val.mode;
  }
  return fallback;
};

export const CustomerDetails = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerPerms = usePermissions('customers');
  const quotePerms = usePermissions('quotations');
  const challanPerms = usePermissions('challans');
  const invoicePerms = usePermissions('invoices');
  const paymentPerms = usePermissions('payments');
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'quotations');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  // 9 Modules Data States
  const [quotations, setQuotations] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [challans, setChallans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [returnsList, setReturnsList] = useState([]);

  // Follow-Up Quick Modal State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    quotationId: '',
    communicationType: 'CALL',
    resultingStatus: 'CUSTOMER_INTERESTED',
    followUpDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: '',
    customerResponse: '',
    remarks: '',
    expectedOrderValue: ''
  });

  // View Follow-Up Details Modal State
  const [viewFollowUpModal, setViewFollowUpModal] = useState({
    isOpen: false,
    followUp: null
  });

  // Delete Follow-Up Confirmation Modal State
  const [deleteFollowUpModal, setDeleteFollowUpModal] = useState({
    isOpen: false,
    followUp: null,
    deleting: false
  });

  // Checklist & Confirmation Modal State
  const [checklistTarget, setChecklistTarget] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistRemarks, setChecklistRemarks] = useState('');
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  // Status Change Modal State
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    quotation: null,
    status: 'Customer Interested',
    remarks: '',
    saving: false
  });

  // Cancel Quotation Modal State
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    quotation: null,
    remarks: '',
    cancelling: false
  });

  // View Challan Modal State
  const [viewChallanModal, setViewChallanModal] = useState({
    isOpen: false,
    loading: false,
    challan: null
  });

  // View Payment Modal State
  const [viewPaymentModal, setViewPaymentModal] = useState({
    isOpen: false,
    payment: null
  });

  // View Return Modal State
  const [viewReturnModal, setViewReturnModal] = useState({
    isOpen: false,
    returnItem: null
  });

  const handleOpenViewChallan = async (challan) => {
    setViewChallanModal({
      isOpen: true,
      loading: true,
      challan
    });
    try {
      const id = challan.id || challan._id;
      const details = await getChallanById(id);
      setViewChallanModal({
        isOpen: true,
        loading: false,
        challan: details || challan
      });
    } catch (e) {
      setViewChallanModal({
        isOpen: true,
        loading: false,
        challan
      });
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleOpenStatusModal = (quotation) => {
    setStatusModal({
      isOpen: true,
      quotation,
      status: quotation.status || 'Customer Interested',
      remarks: quotation.remarks || '',
      saving: false
    });
  };

  const handleSaveStatusChange = async (e) => {
    e.preventDefault();
    if (!statusModal.quotation) return;
    const q = statusModal.quotation;
    const qId = q.id || q._id;
    const newStatus = statusModal.status;
    const oldStatus = q.status;
    const qAmount = Number(q.confirmedAmount || q.quotationAmount || q.grandTotal || 0);

    setStatusModal(prev => ({ ...prev, saving: true }));
    try {
      await updateQuotationStatus(qId, newStatus, statusModal.remarks);

      if (customer) {
        const wasConfirmed = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(oldStatus);
        const isNowConfirmed = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(newStatus);

        let newSales = Number(customer.totalSales || 0);
        if (!wasConfirmed && isNowConfirmed) {
          newSales += qAmount;
        } else if (wasConfirmed && !isNowConfirmed) {
          newSales = Math.max(0, newSales - qAmount);
        }

        const updatedCust = { ...customer, totalSales: newSales };
        setCustomer(updatedCust);
        saveStoredCustomers([updatedCust]);
      }

      setQuotations(prev => prev.map(item => (item.id === qId || item._id === qId) ? { ...item, status: newStatus, remarks: statusModal.remarks || item.remarks } : item));
      showToast(`Quotation #${q.quotationNumber} status updated to "${newStatus}"`);
      setStatusModal({ isOpen: false, quotation: null, status: 'Draft', remarks: '', saving: false });
      loadAllCustomerData();
    } catch (err) {
      showToast(err.message || 'Failed to update quotation status');
      setStatusModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleOpenCancelModal = (quotation) => {
    setCancelModal({
      isOpen: true,
      quotation,
      remarks: '',
      cancelling: false
    });
  };

  const handleConfirmCancelQuotation = async () => {
    if (!cancelModal.quotation) return;
    const q = cancelModal.quotation;
    const qId = q.id || q._id;
    const wasConfirmed = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(q.status);
    const qAmount = Number(q.confirmedAmount || q.quotationAmount || q.grandTotal || 0);

    setCancelModal(prev => ({ ...prev, cancelling: true }));
    try {
      await cancelQuotation(qId);

      if (customer && wasConfirmed) {
        const newSales = Math.max(0, Number(customer.totalSales || 0) - qAmount);
        const updatedCust = { ...customer, totalSales: newSales };
        setCustomer(updatedCust);
        saveStoredCustomers([updatedCust]);
      }

      setQuotations(prev => prev.map(item => (item.id === qId || item._id === qId) ? { ...item, status: 'Cancelled' } : item));
      showToast(`Quotation #${q.quotationNumber} has been cancelled.`);
      setCancelModal({ isOpen: false, quotation: null, remarks: '', cancelling: false });
      loadAllCustomerData();
    } catch (err) {
      showToast(err.message || 'Failed to cancel quotation');
      setCancelModal(prev => ({ ...prev, cancelling: false }));
    }
  };

  const handleDownloadPdf = async (quotation) => {
    try {
      showToast(`Generating Quotation PDF for #${quotation.quotationNumber}...`);
      await exportQuotationDocument(quotation.id || quotation._id, 'pdf', quotation.quotationNumber, quotation);
    } catch (err) {
      showToast('Error exporting quotation PDF');
    }
  };

  const handleOpenChecklistModal = (quotation) => {
    setChecklistTarget(quotation);
    const rawItems = Array.isArray(quotation.items) && quotation.items.length > 0
      ? quotation.items
      : [
        {
          id: 'item-1',
          productName: quotation.quotationType || 'Ceramic Materials / Tiles Order',
          sku: 'TILES-STD',
          quantity: 1,
          confirmedQty: 1,
          rate: quotation.quotationAmount || quotation.grandTotal || 0,
          amount: quotation.quotationAmount || quotation.grandTotal || 0,
          checked: true
        }
      ];

    const mapped = rawItems.map((item, idx) => ({
      id: item.id || item._id || `item_${idx}`,
      originalQuotationItemId: item.id || item._id || `item_${idx}`,
      sku: item.sku || item.companySku || 'TILE-SKU',
      productName: item.productName || item.name || 'Ceramic Item',
      quantity: Number(item.quantity || 1),
      confirmedQty: Number(item.confirmedQty ?? item.quantity ?? 1),
      rate: Number(item.rate || item.quotedRate || 0),
      checked: true,
      remarks: item.remarks || ''
    }));

    setChecklistItems(mapped);
    setChecklistRemarks(quotation.remarks || 'Order confirmed via Customer Checklist');
  };

  const handleToggleChecklistItem = (idx) => {
    setChecklistItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));
  };

  const handleUpdateChecklistQty = (idx, newQty) => {
    const qty = Math.max(0, Number(newQty || 0));
    setChecklistItems(prev => prev.map((it, i) => i === idx ? { ...it, confirmedQty: qty } : it));
  };

  const handleConfirmFinalizeOrder = async () => {
    if (!checklistTarget) return;
    const qId = checklistTarget.id || checklistTarget._id;
    setConfirmingOrder(true);

    try {
      const activeConfirmedItems = checklistItems.filter(i => i.checked);
      const calculatedAmount = activeConfirmedItems.reduce((sum, i) => sum + (i.confirmedQty * i.rate), 0) || Number(checklistTarget.quotationAmount || checklistTarget.grandTotal || 0);

      await confirmQuotation(qId, {
        items: activeConfirmedItems,
        remarks: checklistRemarks,
        finalConfirmedAmount: calculatedAmount
      });

      // Update local quotation state
      setQuotations(prev => prev.map(q => (q.id === qId || q._id === qId) ? { ...q, status: 'Confirmed', confirmedAmount: calculatedAmount } : q));

      // Update customer total sales
      if (customer) {
        const oldSales = Number(customer.totalSales || 0);
        const newSales = oldSales + calculatedAmount;
        setCustomer(prev => ({ ...prev, totalSales: newSales }));
      }

      showToast(`Quotation #${checklistTarget.quotationNumber} confirmed & finalized! Added ${formatCurrency(calculatedAmount)} to Revenue.`);
      setChecklistTarget(null);
      loadAllCustomerData();
    } catch (err) {
      console.error('Order confirmation failed:', err);
      showToast(err.message || 'Order confirmation failed');
    } finally {
      setConfirmingOrder(false);
    }
  };

  const loadAllCustomerData = async () => {
    try {
      const cust = await getCustomerById(id);
      setCustomer(cust);

      const custId = String(cust.id || cust._id || id);
      const custName = (cust.name || cust.customerName || '').trim();

      const [qtRes, flwRes, chRes, invRes, pmtRes, retRes] = await Promise.all([
        getQuotations({ limit: 1000 }).catch(() => ({ data: [] })),
        getFollowUps().catch(() => []),
        getChallans({ limit: 1000 }).catch(() => ({ data: [] })),
        getInvoices({ limit: 1000 }).catch(() => ({ data: [] })),
        getPayments({ limit: 1000 }).catch(() => ({ data: [] })),
        getReturns().catch(() => [])
      ]);

      // Quotations for this customer
      const rawQuotations = qtRes.data || (Array.isArray(qtRes) ? qtRes : []);
      const filteredQuotations = rawQuotations.filter(q => {
        const qCustId = String(q.customerId || q.customer?._id || q.customer?.id || (typeof q.customer === 'string' ? q.customer : ''));
        const qCustName = (q.customerName || q.customer?.name || q.customer?.customerName || '').toLowerCase().trim();
        return (qCustId && qCustId === custId) || (custName && qCustName && qCustName === custName.toLowerCase());
      });
      setQuotations(filteredQuotations);

      // Follow-ups for this customer
      const rawFollowUps = Array.isArray(flwRes) ? flwRes : (flwRes?.data || []);
      const quotationIds = new Set(filteredQuotations.map(q => String(q.id || q._id)));
      const filteredFlws = rawFollowUps.filter(f => {
        const fCustId = String(f.customerId || f.customer?._id || f.customer?.id || '');
        const fCustName = (f.customerName || f.customer?.name || '').toLowerCase().trim();
        const fQuotId = String(f.quotationId || f.quotation?._id || f.quotation?.id || '');
        return (fCustId && fCustId === custId) ||
          (custName && fCustName && fCustName === custName.toLowerCase()) ||
          (fQuotId && quotationIds.has(fQuotId));
      });
      setFollowUps(filteredFlws);

      // Challans for this customer
      const rawChallans = chRes.data || (Array.isArray(chRes) ? chRes : []);
      const filteredChallans = rawChallans.filter(c => {
        const cCustId = String(c.customerId || c.customer?._id || c.customer?.id || (typeof c.customer === 'string' ? c.customer : ''));
        const cCustName = (c.customerName || c.customer?.name || c.customer?.customerName || '').toLowerCase().trim();
        const cQuotId = String(c.quotationId || c.quotation?._id || c.quotation?.id || (typeof c.quotation === 'string' ? c.quotation : ''));
        return (cCustId && (cCustId === custId || cCustId === String(cust._id) || cCustId === String(cust.id))) ||
          (custName && cCustName && cCustName === custName.toLowerCase()) ||
          (cQuotId && quotationIds.has(cQuotId));
      });
      setChallans(filteredChallans);

      // Invoices for this customer
      const rawInvoices = invRes.data || (Array.isArray(invRes) ? invRes : []);
      const filteredInvoices = rawInvoices.filter(inv => {
        const invCustId = String(inv.customerId || inv.customer?._id || inv.customer?.id || '');
        const invCustName = (inv.customerName || inv.customer?.name || '').toLowerCase().trim();
        return (invCustId && invCustId === custId) || (custName && invCustName && invCustName === custName.toLowerCase());
      });
      setInvoices(filteredInvoices);

      // Payments strictly for this customer
      const rawPayments = pmtRes.data || (Array.isArray(pmtRes) ? pmtRes : []);
      const invoiceIds = new Set(filteredInvoices.map(inv => String(inv.id || inv._id)));
      const invoiceNums = new Set(filteredInvoices.map(inv => String(inv.invoiceNumber || '').toLowerCase().trim()).filter(Boolean));

      const filteredPayments = rawPayments.filter(p => {
        const pCustId = String(p.customerId || p.customer?._id || p.customer?.id || (typeof p.customer === 'string' ? p.customer : ''));
        const pCustName = (p.customerName || p.customer?.name || p.customer?.customerName || '').toLowerCase().trim();
        const pInvId = String(p.invoiceId || p.invoice?._id || p.invoice?.id || '');
        const pInvNum = String(p.invoiceNumber || '').toLowerCase().trim();

        const matchesInvoice = (pInvId && invoiceIds.has(pInvId)) || (pInvNum && invoiceNums.has(pInvNum));
        const matchesAllocation = Array.isArray(p.allocations) && p.allocations.some(a => {
          const aInvId = String(a.invoiceId || a.invoice?._id || a.invoice?.id || a.invoice || '');
          const aInvNum = String(a.invoiceNumber || '').toLowerCase().trim();
          return (aInvId && invoiceIds.has(aInvId)) || (aInvNum && invoiceNums.has(aInvNum));
        });

        return (pCustId && pCustId === custId) ||
          (custName && pCustName && pCustName === custName.toLowerCase()) ||
          matchesInvoice ||
          matchesAllocation;
      });
      setPayments(filteredPayments);

      // Returns for this customer
      const rawReturns = Array.isArray(retRes) ? retRes : (retRes?.data || []);
      const filteredReturns = rawReturns.filter(r => {
        const rCustId = String(r.customerId || r.customer?._id || r.customer?.id || (typeof r.customer === 'string' ? r.customer : ''));
        const rCustName = (r.customerName || r.customer?.name || r.customer?.customerName || '').toLowerCase().trim();
        const rInvNum = (r.invoiceNumber || '').toLowerCase().trim();
        return (rCustId && (rCustId === custId || rCustId === String(cust._id) || rCustId === String(cust.id))) ||
          (custName && rCustName && rCustName === custName.toLowerCase()) ||
          (rInvNum && invoiceNums.has(rInvNum));
      });
      setReturnsList(filteredReturns);

    } catch (err) {
      console.error('Error loading customer 360 data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadAllCustomerData();
  }, [id]);

  // Open Follow-up modal for Create or Edit
  const handleOpenFollowUpModal = (quotationId = '', existingFollowUp = null) => {
    if (existingFollowUp) {
      setEditingFollowUpId(existingFollowUp.id || existingFollowUp._id);
      setFollowUpForm({
        quotationId: existingFollowUp.quotationId || '',
        communicationType: existingFollowUp.communicationType || 'CALL',
        resultingStatus: existingFollowUp.resultingStatus || existingFollowUp.status || 'CUSTOMER_INTERESTED',
        followUpDate: existingFollowUp.followUpDate ? existingFollowUp.followUpDate.split('T')[0] : new Date().toISOString().split('T')[0],
        nextFollowUpDate: existingFollowUp.nextFollowUpDate ? existingFollowUp.nextFollowUpDate.split('T')[0] : '',
        customerResponse: existingFollowUp.customerResponse || '',
        remarks: existingFollowUp.remarks || '',
        expectedOrderValue: existingFollowUp.expectedOrderValue || ''
      });
    } else {
      setEditingFollowUpId(null);
      setFollowUpForm({
        quotationId: quotationId || (quotations[0]?.id || ''),
        communicationType: 'CALL',
        resultingStatus: 'CUSTOMER_INTERESTED',
        followUpDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        customerResponse: '',
        remarks: '',
        expectedOrderValue: quotations[0]?.quotationAmount || ''
      });
    }
    setIsFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    setSavingFollowUp(true);
    try {
      if (editingFollowUpId) {
        await updateFollowUp(editingFollowUpId, {
          ...followUpForm,
          customerId: customer?.id,
          customerName: customer?.name
        });
        showToast('Follow-up record updated successfully!');
      } else {
        await createFollowUp({
          ...followUpForm,
          customerId: customer?.id,
          customerName: customer?.name
        });
        showToast('Follow-up logged successfully!');
      }
      setIsFollowUpModalOpen(false);
      setEditingFollowUpId(null);
      loadAllCustomerData();
    } catch (err) {
      showToast(err.message || 'Failed to save follow-up');
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleOpenViewFollowUp = (followUp) => {
    setViewFollowUpModal({
      isOpen: true,
      followUp
    });
  };

  const handleOpenDeleteFollowUp = (followUp) => {
    setDeleteFollowUpModal({
      isOpen: true,
      followUp,
      deleting: false
    });
  };

  const handleConfirmDeleteFollowUp = async () => {
    if (!deleteFollowUpModal.followUp) return;
    const fId = deleteFollowUpModal.followUp.id || deleteFollowUpModal.followUp._id;
    setDeleteFollowUpModal(prev => ({ ...prev, deleting: true }));
    try {
      await deleteFollowUp(fId);
      setFollowUps(prev => prev.filter(f => f.id !== fId && f._id !== fId));
      showToast('Follow-up record deleted.');
      setDeleteFollowUpModal({ isOpen: false, followUp: null, deleting: false });
      loadAllCustomerData();
    } catch (err) {
      showToast(err.message || 'Failed to delete follow-up');
      setDeleteFollowUpModal(prev => ({ ...prev, deleting: false }));
    }
  };

  // Build Running Ledger Entries
  const computedLedger = useMemo(() => {
    const ledgerEntries = [];
    invoices.forEach(inv => {
      ledgerEntries.push({
        date: inv.date,
        type: 'INVOICE',
        ref: inv.invoiceNumber,
        particular: `Sales Invoice #${inv.invoiceNumber}`,
        debit: Number(inv.finalTotal || inv.netTotal || 0),
        credit: 0
      });
    });
    payments.forEach(pmt => {
      ledgerEntries.push({
        date: pmt.date,
        type: 'PAYMENT',
        ref: pmt.receiptNumber,
        particular: `Payment Received #${pmt.receiptNumber} (${getSafeMode(pmt.paymentMode)})`,
        debit: 0,
        credit: Number(pmt.amount || 0)
      });
    });
    returnsList.forEach(ret => {
      ledgerEntries.push({
        date: ret.date,
        type: 'RETURN',
        ref: ret.returnNoteNumber,
        particular: `Sales Return Credit Note #${ret.returnNoteNumber}`,
        debit: 0,
        credit: Number(ret.refundAmount || 0)
      });
    });

    ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBal = 0;
    return ledgerEntries.map(e => {
      runningBal += (e.debit - e.credit);
      return { ...e, balance: runningBal };
    });
  }, [invoices, payments, returnsList]);

  // Product Purchase History
  const productHistory = useMemo(() => {
    const list = [];
    invoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          list.push({
            date: inv.date,
            invoiceNumber: inv.invoiceNumber,
            sku: item.sku || item.companySku || '-',
            productName: item.productName || 'Ceramic Item',
            quantity: Number(item.quantity || 1),
            unit: item.unit || 'Sq.Ft',
            rate: Number(item.rate || item.unitRate || 0),
            amount: Number(item.amount || (item.quantity * item.rate) || 0)
          });
        });
      }
    });
    return list;
  }, [invoices]);

  const activeCustId = customer?.id || customer?._id || id;

  const confirmedOrders = useMemo(() => {
    return quotations.filter(q => ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(q.status));
  }, [quotations]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '1rem' }}>
        <div className="spinner-circle" />
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#475569' }}>Loading Customer 360° Hub...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        <h3>Customer not found</h3>
        <Link to="/customers" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Directory</Link>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="floating-toast-container">
          <div className="floating-toast">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Header Navigation & Customer Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/customers" className="btn btn-secondary btn-sm" style={{ borderRadius: '8px', padding: '0.45rem 0.85rem' }}>
            <ArrowLeft size={16} />
            <span>Customer Directory</span>
          </Link>
          {(customer.customerCode || customer.code) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.825rem', color: '#64748b' }}>Customer Code:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#0f172a' }}>{customer.customerCode || customer.code}</strong>
            </div>
          ) : null}
        </div>

        {/* Action Buttons Hub: Create Anything for This Customer Instantly */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {quotePerms.canCreate && (
            <Link
              to={`/quotations/create?customerId=${activeCustId}`}
              className="btn btn-primary btn-sm"
              style={{ borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={15} />
              <span>New Quotation</span>
            </Link>
          )}

          {quotePerms.canCreate && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenFollowUpModal()}
              style={{ borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}
            >
              <PhoneCall size={14} />
              <span>Log Follow-Up</span>
            </button>
          )}

          {challanPerms.canCreate && (
            <Link
              to={`/challans/create?customerId=${activeCustId}`}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Truck size={14} />
              <span>New Challan</span>
            </Link>
          )}

          {invoicePerms.canCreate && (
            <Link
              to={`/invoices/create?customerId=${activeCustId}`}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Receipt size={14} />
              <span>Create Invoice</span>
            </Link>
          )}

          {paymentPerms.canCreate && (
            <Link
              to={`/payments/entry?customerId=${activeCustId}`}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
            >
              <CreditCard size={14} />
              <span>Record Payment</span>
            </Link>
          )}

          {customerPerms.canEdit && (
            <Link
              to={`/customers/edit/${activeCustId}`}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: '8px' }}
            >
              <Edit size={14} />
              <span>Edit Profile</span>
            </Link>
          )}
        </div>
      </div>

      {/* Customer 360 Profile Hero Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {customer.name || customer.customerName}
              </h1>
              <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                {customer.customerType || 'Customer'}
              </span>
              <span className={`badge ${customer.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                {customer.isActive !== false ? 'Active' : 'Inactive'}
              </span>
              {(customer.reference || customer.referenceBy) && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  fontWeight: 600
                }}>
                  Ref: {customer.reference || customer.referenceBy}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', color: '#475569', fontSize: '0.85rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={15} style={{ color: '#2563eb' }} />
                <span>{customer.mobile || '-'} {customer.altMobile ? `/ ${customer.altMobile}` : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={15} style={{ color: '#0284c7' }} />
                <span>{customer.email || 'No email registered'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={15} style={{ color: '#dc2626' }} />
                <span>{customer.billingAddress || customer.city || '-'}, {customer.state || 'Gujarat'}</span>
              </div>
              {customer.gstNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileCheck size={15} style={{ color: '#16a34a' }} />
                  <span>GSTIN: <strong>{customer.gstNumber}</strong></span>
                </div>
              )}
              {(customer.reference || customer.referenceBy) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <UserCheck size={15} style={{ color: '#d97706' }} />
                  <span>Reference: <strong>{customer.reference || customer.referenceBy}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Quotations</div>
          <div className="stat-value">{quotations.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Invoiced</div>
          <div className="stat-value">{formatCurrency(customer.totalInvoiced || invoices.reduce((acc, i) => acc + Number(i.finalTotal || 0), 0))}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Paid (Received)</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>
            {formatCurrency(customer.totalPaid || payments.reduce((acc, p) => acc + Number(p.amount || 0), 0))}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Outstanding</div>
          <div className="stat-value" style={{ color: (customer.totalOutstanding || 0) > 0 ? '#dc2626' : '#0f172a' }}>
            {formatCurrency(customer.totalOutstanding || 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credit Balance</div>
          <div className="stat-value">{formatCurrency(customer.credit || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Confirmed Orders</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>{confirmedOrders.length}</div>
        </div>
      </div>

      {/* 9 Workstation Tabs: Responsive Smooth Scroll Layout */}
      <div 
        className="workstation-tabs-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
          overflow: 'visible',
          marginBottom: '1.25rem',
          padding: '0.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          width: '100%',
          maxWidth: '100%',
          position: 'relative',
          zIndex: 40
        }}
      >
        {[
          { id: 'quotations', label: 'Quotations', count: quotations.length, icon: FileText },
          { id: 'follow-ups', label: 'Follow-Ups', count: followUps.length, icon: PhoneCall },
          { id: 'orders', label: 'Orders', count: confirmedOrders.length, icon: CheckCircle2 },
          { id: 'challans', label: 'Challans', count: challans.length, icon: Truck },
          { id: 'invoices', label: 'Invoices', count: invoices.length, icon: Receipt },
          { id: 'payments', label: 'Payments', count: payments.length, icon: CreditCard },
          { id: 'returns', label: 'Returns', count: returnsList.length, icon: RotateCcw },
          { id: 'ledger', label: 'Ledger', count: computedLedger.length, icon: BookOpen },
          { id: 'product-history', label: 'Products', count: productHistory.length, icon: ShoppingBag }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.currentTarget.blur();
                handleTabChange(tab.id);
              }}
              data-tooltip={isActive ? undefined : `View ${tab.label} (${tab.count})`}
              style={{
                flex: '1 0 auto',
                minWidth: 'max-content',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 600,
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: isActive ? '1px solid #93c5fd' : '1px solid #f1f5f9',
                backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                color: isActive ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                userSelect: 'none',
                position: 'relative'
              }}
            >
              <Icon size={15} style={{ color: isActive ? '#2563eb' : '#64748b', flexShrink: 0 }} />
              <span>{tab.label}</span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: isActive ? '#dbeafe' : '#f1f5f9',
                color: isActive ? '#1e40af' : '#64748b',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px'
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Workstation Content Container */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflowX: 'auto' }}>

        {/* Tab 1: Quotations */}
        {activeTab === 'quotations' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Customer Quotation History & Confirmed Commitments</span>
              {quotePerms.canCreate && (
                <Link
                  to={`/quotations/create?customerId=${activeCustId}`}
                  className="btn btn-primary btn-sm"
                  style={{ borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} /> New Quotation
                </Link>
              )}
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Quotation No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Salesperson</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Quotation Type</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status / Confirmation</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '320px' }}>Order Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No quotations created yet for this customer.</td></tr>
                ) : (
                  quotations.map(q => {
                    const isFinalized = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(q.status);
                    const isCancelled = ['Cancelled', 'Rejected'].includes(q.status);

                    return (
                      <tr key={q.id || q._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                          <Link to={`/quotations/${q.id || q._id}`} style={{ color: '#2563eb', textDecoration: 'none' }} data-tooltip="View Quotation">
                            {q.quotationNumber}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(q.date)}</td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{q.salesperson || 'Vikram Mehta'}</td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{q.quotationType || 'STANDARD'}</td>
                        <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, color: isFinalized ? '#16a34a' : (isCancelled ? '#dc2626' : '#0f172a') }}>
                          {formatCurrency(q.confirmedAmount || q.quotationAmount || q.grandTotal)}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                          {isFinalized ? (
                            <span style={{
                              backgroundColor: '#f0fdf4',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.75rem'
                            }}>
                              <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
                              <span>✓ Finalized / Confirmed</span>
                            </span>
                          ) : (
                            <StatusBadge status={q.status} />
                          )}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                          <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'center' }}>
                            {/* 1. View Quotation */}
                            <Link
                              to={`/quotations/${q.id || q._id}`}
                              className="action-btn"
                              data-tooltip="View Quotation Details"
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '7px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe'
                              }}
                            >
                              <Eye size={14} />
                            </Link>

                            {/* 2. Checklist / Confirm OR Dispatch */}
                            {quotePerms.canEdit && !isFinalized && !isCancelled ? (
                              <button
                                type="button"
                                onClick={() => handleOpenChecklistModal(q)}
                                className="action-btn"
                                data-tooltip="Checklist: Finalize & Confirm Order"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#f0fdf4',
                                  color: '#16a34a',
                                  border: '1px solid #bbf7d0'
                                }}
                              >
                                <CheckSquare size={14} />
                              </button>
                            ) : challanPerms.canCreate && isFinalized ? (
                              <Link
                                to={`/challans/create?customerId=${activeCustId}&quotationId=${q.id || q._id}`}
                                className="action-btn"
                                data-tooltip="Dispatch Delivery Challan"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#fff7ed',
                                  color: '#ea580c',
                                  border: '1px solid #fed7aa'
                                }}
                              >
                                <Truck size={14} />
                              </Link>
                            ) : null}

                            {/* 3. Update Status */}
                            {quotePerms.canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(q)}
                                className="action-btn"
                                data-tooltip="Update Quotation Status"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#f0f9ff',
                                  color: '#0284c7',
                                  border: '1px solid #bae6fd'
                                }}
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}

                            {/* 4. Download PDF */}
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(q)}
                              className="action-btn"
                              data-tooltip="Download Quotation PDF"
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '7px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#f8fafc',
                                color: '#475569',
                                border: '1px solid #cbd5e1'
                              }}
                            >
                              <Download size={14} />
                            </button>

                            {/* 5. Log Follow-Up */}
                            {quotePerms.canCreate && (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleOpenFollowUpModal(q.id || q._id)}
                                data-tooltip="Log Customer Follow-Up"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#9333ea',
                                  backgroundColor: '#faf5ff',
                                  border: '1px solid #e9d5ff'
                                }}
                              >
                                <PhoneCall size={14} />
                              </button>
                            )}

                            {/* 6. Create Tax Invoice */}
                            {invoicePerms.canCreate && (
                              <Link
                                to={`/invoices/create?customerId=${activeCustId}&quotationId=${q.id || q._id}`}
                                className="action-btn"
                                data-tooltip="Create Tax Invoice"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#fdf2f8',
                                  color: '#db2777',
                                  border: '1px solid #fbcfe8'
                                }}
                              >
                                <Receipt size={14} />
                              </Link>
                            )}

                            {/* 7. Cancel Quotation (if not already cancelled) */}
                            {quotePerms.canDelete && !isCancelled && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancelModal(q)}
                                className="action-btn"
                                data-tooltip="Cancel Quotation"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca'
                                }}
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Follow-ups */}
        {activeTab === 'follow-ups' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Customer Interaction & Follow-Up Timeline</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenFollowUpModal()}
                style={{ borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> Log New Follow-Up
              </button>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Quotation Ref</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Mode</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Salesperson</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Customer Response / Notes</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Next Follow-Up</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '130px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {followUps.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No follow-up logs recorded yet for this customer.</td></tr>
                ) : (
                  followUps.map((f, i) => (
                    <tr key={f.id || f._id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(f.followUpDate || f.date)}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {f.quotationNumber || (f.quotationId ? `QT-${String(f.quotationId).slice(-6)}` : 'General')}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          display: 'inline-block',
                          backgroundColor: f.communicationType === 'WHATSAPP' ? '#f0fdf4' : f.communicationType === 'CALL' ? '#eff6ff' : '#f8fafc',
                          color: f.communicationType === 'WHATSAPP' ? '#16a34a' : f.communicationType === 'CALL' ? '#2563eb' : '#475569',
                          border: `1px solid ${f.communicationType === 'WHATSAPP' ? '#bbf7d0' : f.communicationType === 'CALL' ? '#bfdbfe' : '#e2e8f0'}`
                        }}>
                          {f.communicationType}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{f.salesperson || 'Staff'}</td>
                      <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '0.65rem 0.75rem', maxWidth: '280px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.customerResponse || f.remarks || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 600, color: f.nextFollowUpDate ? '#d97706' : '#64748b' }}>
                        {f.nextFollowUpDate ? formatDate(f.nextFollowUpDate) : '-'}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <StatusBadge status={f.resultingStatus || f.status} />
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                          {/* 1. View Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenViewFollowUp(f)}
                            className="action-btn"
                            data-tooltip="View Interaction History"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            <Eye size={14} />
                          </button>

                          {/* 2. Edit Record */}
                          <button
                            type="button"
                            onClick={() => handleOpenFollowUpModal(f.quotationId || '', f)}
                            className="action-btn"
                            data-tooltip="Edit Follow-Up Record"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f0fdf4',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0'
                            }}
                          >
                            <Edit size={14} />
                          </button>

                          {/* 3. Delete Record */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteFollowUp(f)}
                            className="action-btn"
                            data-tooltip="Delete Follow-Up Record"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Confirmed Orders */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Customer Confirmed Material Commitments</span>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Order / Ref No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Confirmed Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Linked Quotation</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Confirmed Amount</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {confirmedOrders.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No confirmed orders yet. Confirm items in the Quotations tab to realize order commitment.</td></tr>
                ) : (
                  confirmedOrders.map(q => (
                    <tr key={q.id || q._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, color: '#0f172a' }}>
                        ORD-{q.quotationNumber?.replace('QT-', '') || q.id}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(q.confirmedAt || q.date)}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>
                        <Link to={`/quotations/${q.id || q._id}`} data-tooltip="View Linked Quotation" style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {q.quotationNumber}
                        </Link>
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, color: '#16a34a' }}>
                        {formatCurrency(q.confirmedAmount || q.quotationAmount)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <StatusBadge status="Confirmed" />
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                          <Link
                            to={`/quotations/${q.id || q._id}`}
                            className="action-btn"
                            data-tooltip="View Quotation Details"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            <Eye size={14} />
                          </Link>
                          <Link
                            to={`/challans/create?customerId=${activeCustId}&quotationId=${q.id || q._id}`}
                            className="action-btn"
                            data-tooltip="Dispatch Delivery Challan"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#fff7ed',
                              color: '#ea580c',
                              border: '1px solid #fed7aa'
                            }}
                          >
                            <Truck size={14} />
                          </Link>
                          <Link
                            to={`/invoices/create?customerId=${activeCustId}&quotationId=${q.id || q._id}`}
                            className="action-btn"
                            data-tooltip="Create Tax Invoice"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#fdf2f8',
                              color: '#db2777',
                              border: '1px solid #fbcfe8'
                            }}
                          >
                            <Receipt size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Delivery Challans */}
        {activeTab === 'challans' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Material Delivery Challans</span>
              <Link
                to={`/challans/create?customerId=${activeCustId}`}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> Create Challan
              </Link>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Challan No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Ref Quotation</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Driver / Vehicle</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challans.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No delivery challans generated.</td></tr>
                ) : (
                  challans.map(c => (
                    <tr key={c.id || c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenViewChallan(c)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontSize: '0.825rem',
                            textDecoration: 'underline'
                          }}
                          data-tooltip="View Challan Details"
                        >
                          {c.challanNumber}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(c.date)}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{c.refQuotationNo || '-'}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{c.driverName || '-'} {c.vehicleNo ? `(${c.vehicleNo})` : ''}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <StatusBadge status={c.status || 'Dispatched'} />
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenViewChallan(c)}
                            className="action-btn"
                            data-tooltip="View Delivery Challan"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <Link
                            to={`/invoices/create?customerId=${activeCustId}&challanId=${c.id || c._id}`}
                            className="action-btn"
                            data-tooltip="Create Tax Invoice for Challan"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#fdf2f8',
                              color: '#db2777',
                              border: '1px solid #fbcfe8'
                            }}
                          >
                            <Receipt size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Sales Invoices */}
        {activeTab === 'invoices' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Tax Invoices & GST Billed</span>
              <Link
                to={`/invoices/create?customerId=${activeCustId}`}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> New Invoice
              </Link>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Invoice No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Total Amount</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Paid Amount</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Outstanding</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No invoices billed to customer.</td></tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id || inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(inv.date)}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700 }}>
                        {formatCurrency(inv.finalTotal || inv.netTotal)}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', color: '#16a34a', fontWeight: 600 }}>
                        {formatCurrency(inv.paidAmount || 0)}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, color: Number(inv.outstandingAmount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(inv.outstandingAmount || 0)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                          <Link
                            to={`/invoices/${inv.id || inv._id}`}
                            className="action-btn"
                            data-tooltip="View Tax Invoice"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            <Eye size={14} />
                          </Link>
                          {Number(inv.outstandingAmount || 0) > 0 && (
                            <Link
                              to={`/payments/entry?customerId=${activeCustId}&invoiceId=${inv.id || inv._id}`}
                              className="action-btn"
                              data-tooltip="Record Payment Against Invoice"
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '7px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#16a34a',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0'
                              }}
                            >
                              <CreditCard size={14} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 6: Payments */}
        {activeTab === 'payments' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Payment Receipts & Collections</span>
              <Link
                to={`/payments/entry?customerId=${activeCustId}`}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> Record Payment
              </Link>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Receipt No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Invoice Ref</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Payment Mode</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Ref / Cheque No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No payments recorded yet.</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id || p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        <button
                          type="button"
                          onClick={() => setViewPaymentModal({ isOpen: true, payment: p })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontSize: '0.825rem',
                            textDecoration: 'underline'
                          }}
                          data-tooltip="View Payment Details"
                        >
                          {p.receiptNumber}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(p.date)}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{p.invoiceNumber || '-'}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{getSafeMode(p.paymentMode)}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, color: '#16a34a' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{p.referenceNumber || '-'}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setViewPaymentModal({ isOpen: true, payment: p })}
                            className="action-btn"
                            data-tooltip="View Payment Breakdown"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <Link
                            to={`/payments/${p.id || p._id}`}
                            className="action-btn"
                            data-tooltip="Print Payment Receipt"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #cbd5e1'
                            }}
                          >
                            <Printer size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 7: Returns */}
        {activeTab === 'returns' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Customer Sales Returns & Credit Notes</span>
              <Link
                to={`/returns?customerId=${activeCustId}`}
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> Record Return Note
              </Link>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Return Note No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Product Name</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Return Qty</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Reason</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700, width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returnsList.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No sales return notes recorded.</td></tr>
                ) : (
                  returnsList.map(r => (
                    <tr key={r.id || r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        <button
                          type="button"
                          onClick={() => setViewReturnModal({ isOpen: true, returnItem: r })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontSize: '0.825rem',
                            textDecoration: 'underline'
                          }}
                          data-tooltip="View Return Details"
                        >
                          {r.returnNoteNumber}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(r.date)}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{r.sku}</td>
                      <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 600 }}>{r.productName}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700, color: '#dc2626' }}>
                        {r.quantity} {r.unit}
                      </td>
                      <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{r.returnReason || '-'}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setViewReturnModal({ isOpen: true, returnItem: r })}
                          className="action-btn"
                          data-tooltip="View Return Note"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '7px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 8: Account Statement / Ledger */}
        {activeTab === 'ledger' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Live Running Account Ledger & Statement</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ borderRadius: '6px' }}>
                <Printer size={14} /> Print Statement
              </button>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Particulars / Document Reference</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Debit (+)</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Credit (-)</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {computedLedger.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No ledger movements recorded.</td></tr>
                ) : (
                  computedLedger.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(l.date)}</td>
                      <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 600 }}>{l.particular}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', color: l.debit > 0 ? '#dc2626' : 'inherit', fontWeight: l.debit > 0 ? 600 : 400 }}>
                        {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', color: l.credit > 0 ? '#16a34a' : 'inherit', fontWeight: l.credit > 0 ? 600 : 400 }}>
                        {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 800, color: l.balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(l.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 9: Product Purchase History */}
        {activeTab === 'product-history' && (
          <div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>All Products Purchased by {customer.name}</span>
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Invoice Date</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Invoice No.</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Product Description</th>
                  <th style={{ textAlign: 'center', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Quantity</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontWeight: 700 }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {productHistory.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No product sales records found.</td></tr>
                ) : (
                  productHistory.map((ph, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatDate(ph.date)}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{ph.invoiceNumber}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{ph.sku}</td>
                      <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 600 }}>{ph.productName}</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700 }}>{ph.quantity} {ph.unit}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem' }}>{formatCurrency(ph.rate)}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'middle', padding: '0.65rem 0.75rem', fontWeight: 700 }}>{formatCurrency(ph.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Quick Follow-Up Modal */}
      {isFollowUpModalOpen && (
        <Modal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          title={`Log Follow-Up: ${customer.name}`}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setIsFollowUpModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveFollowUp} disabled={savingFollowUp}>
                {savingFollowUp ? 'Saving...' : 'Save Follow-Up'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Communication Type</label>
                <select
                  className="form-control"
                  value={followUpForm.communicationType}
                  onChange={e => setFollowUpForm({ ...followUpForm, communicationType: e.target.value })}
                  style={{ height: '36px', fontSize: '0.825rem' }}
                >
                  {COMMUNICATION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Resulting Status</label>
                <select
                  className="form-control"
                  value={followUpForm.resultingStatus}
                  onChange={e => setFollowUpForm({ ...followUpForm, resultingStatus: e.target.value })}
                  style={{ height: '36px', fontSize: '0.825rem' }}
                >
                  {RESULTING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Follow-Up Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={followUpForm.followUpDate}
                  onChange={e => setFollowUpForm({ ...followUpForm, followUpDate: e.target.value })}
                  style={{ height: '36px', fontSize: '0.825rem' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Next Scheduled Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={followUpForm.nextFollowUpDate}
                  onChange={e => setFollowUpForm({ ...followUpForm, nextFollowUpDate: e.target.value })}
                  style={{ height: '36px', fontSize: '0.825rem' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Linked Quotation (Optional)</label>
              <select
                className="form-control"
                value={followUpForm.quotationId}
                onChange={e => setFollowUpForm({ ...followUpForm, quotationId: e.target.value })}
                style={{ height: '36px', fontSize: '0.825rem' }}
              >
                <option value="">General Customer Follow-Up (No Quotation)</option>
                {quotations.map(q => (
                  <option key={q.id || q._id} value={q.id || q._id}>
                    {q.quotationNumber} - ₹{q.quotationAmount || q.grandTotal} ({q.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Customer Conversation / Notes <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="What did customer say? Next steps, design preferences, rate negotiation..."
                value={followUpForm.customerResponse}
                onChange={e => setFollowUpForm({ ...followUpForm, customerResponse: e.target.value })}
                required
                style={{ fontSize: '0.825rem' }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Order Checklist & Final Confirmation Modal */}
      {checklistTarget && (
        <Modal
          isOpen={Boolean(checklistTarget)}
          onClose={() => setChecklistTarget(null)}
          title={`Order Checklist & Final Confirmation — ${checklistTarget.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700 }}>
                Confirmed Total:{' '}
                <span style={{ color: '#16a34a', fontSize: '1rem', fontWeight: 800 }}>
                  {formatCurrency(
                    checklistItems
                      .filter(i => i.checked)
                      .reduce((sum, i) => sum + (i.confirmedQty * i.rate), 0)
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setChecklistTarget(null)}
                  style={{ borderRadius: '8px', fontSize: '0.825rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmFinalizeOrder}
                  disabled={confirmingOrder}
                  style={{ borderRadius: '8px', fontSize: '0.825rem', backgroundColor: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <CheckCircle2 size={15} />
                  <span>{confirmingOrder ? 'Finalizing Order...' : 'Confirm & Finalize Order (✓)'}</span>
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CUSTOMER</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{customer.name} ({customer.mobile})</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>QUOTATION DATE</span>
                <div style={{ fontWeight: 600, color: '#475569' }}>{formatDate(checklistTarget.date)}</div>
              </div>
            </div>

            {/* Checklist items table */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Material Checklist (Select items customer agreed to order)</span>
                <span style={{ color: '#16a34a' }}>{checklistItems.filter(i => i.checked).length} of {checklistItems.length} selected</span>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '0.5rem', width: '36px', textAlign: 'center' }}></th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Item & SKU</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, width: '90px' }}>Rate</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, width: '100px' }}>Confirmed Qty</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, width: '100px' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklistItems.map((item, idx) => {
                      const itemSubtotal = (item.confirmedQty || 0) * (item.rate || 0);

                      return (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: item.checked ? '#ffffff' : '#f8fafc', opacity: item.checked ? 1 : 0.6 }}>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleChecklistItem(idx)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#16a34a' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.productName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>SKU: {item.sku}</div>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            {formatCurrency(item.rate)}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="1"
                              disabled={!item.checked}
                              value={item.confirmedQty}
                              onChange={e => handleUpdateChecklistQty(idx, e.target.value)}
                              className="form-control"
                              style={{ width: '75px', height: '32px', textAlign: 'center', fontSize: '0.8rem', padding: '0.2rem', margin: '0 auto' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: item.checked ? '#16a34a' : '#94a3b8' }}>
                            {formatCurrency(itemSubtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Confirmation Notes / Customer Agreement</label>
              <textarea
                className="form-control"
                rows={2}
                value={checklistRemarks}
                onChange={e => setChecklistRemarks(e.target.value)}
                placeholder="e.g. Approved site measurements, advance received, delivery requested by next Monday..."
                style={{ fontSize: '0.825rem' }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Status Update Modal */}
      {statusModal.isOpen && statusModal.quotation && (
        <Modal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false, quotation: null }))}
          title={`Update Status — Quotation #${statusModal.quotation.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false, quotation: null }))}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveStatusChange}
                disabled={statusModal.saving}
                style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Check size={15} />
                <span>{statusModal.saving ? 'Updating...' : 'Save New Status'}</span>
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveStatusChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CURRENT STATUS</span>
                <div><StatusBadge status={statusModal.quotation.status} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>QUOTATION AMOUNT</span>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(statusModal.quotation.confirmedAmount || statusModal.quotation.quotationAmount || statusModal.quotation.grandTotal)}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Select New Quotation Status *</label>
              <select
                className="form-control"
                value={statusModal.status}
                onChange={e => setStatusModal(prev => ({ ...prev, status: e.target.value }))}
                style={{ fontSize: '0.85rem', height: '38px', borderRadius: '8px' }}
                required
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent (Delivered to Customer)</option>
                <option value="Confirmed">Confirmed (Realized Sale)</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Status Remarks / Next Action</label>
              <textarea
                className="form-control"
                rows={2}
                value={statusModal.remarks}
                onChange={e => setStatusModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Add details regarding status transition, client feedback or agreement..."
                style={{ fontSize: '0.825rem', borderRadius: '8px' }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Quotation Confirmation Modal */}
      {cancelModal.isOpen && cancelModal.quotation && (
        <Modal
          isOpen={cancelModal.isOpen}
          onClose={() => setCancelModal(prev => ({ ...prev, isOpen: false, quotation: null }))}
          title={`Cancel Quotation — #${cancelModal.quotation.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelModal(prev => ({ ...prev, isOpen: false, quotation: null }))}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancelQuotation}
                disabled={cancelModal.cancelling}
                style={{ borderRadius: '8px', fontSize: '0.825rem', backgroundColor: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Ban size={15} />
                <span>{cancelModal.cancelling ? 'Cancelling...' : 'Yes, Cancel Quotation'}</span>
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.85rem' }}>Are you sure you want to cancel this quotation?</div>
                <div style={{ color: '#b91c1c', fontSize: '0.775rem', marginTop: '0.2rem' }}>
                  This will mark Quotation #{cancelModal.quotation.quotationNumber} as Cancelled and remove it from active revenue/commitments.
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>Cancellation Reason / Notes</label>
              <textarea
                className="form-control"
                rows={2}
                value={cancelModal.remarks}
                onChange={e => setCancelModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Reason for cancellation (e.g. Client opted for alternative, budget constraints, deal expired)..."
                style={{ fontSize: '0.825rem', borderRadius: '8px' }}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* View Follow-Up History Details Modal */}
      {viewFollowUpModal.isOpen && viewFollowUpModal.followUp && (
        <Modal
          isOpen={viewFollowUpModal.isOpen}
          onClose={() => setViewFollowUpModal({ isOpen: false, followUp: null })}
          title="Follow-Up Interaction Details & History"
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewFollowUpModal({ isOpen: false, followUp: null })}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const target = viewFollowUpModal.followUp;
                  setViewFollowUpModal({ isOpen: false, followUp: null });
                  handleOpenFollowUpModal(target.quotationId || '', target);
                }}
                style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Edit size={14} />
                <span>Edit Record</span>
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CUSTOMER</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{customer.name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>COMMUNICATION MODE</span>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{viewFollowUpModal.followUp.communicationType || 'CALL'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>INTERACTION DATE</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatDate(viewFollowUpModal.followUp.followUpDate || viewFollowUpModal.followUp.date)}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>NEXT SCHEDULED DATE</span>
                <div style={{ fontWeight: 600, color: viewFollowUpModal.followUp.nextFollowUpDate ? '#d97706' : '#64748b' }}>
                  {viewFollowUpModal.followUp.nextFollowUpDate ? formatDate(viewFollowUpModal.followUp.nextFollowUpDate) : 'None Scheduled'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>LINKED QUOTATION</span>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                  {viewFollowUpModal.followUp.quotationNumber || (viewFollowUpModal.followUp.quotationId ? `QT-${String(viewFollowUpModal.followUp.quotationId).slice(-6)}` : 'General')}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>RESULTING STATUS</span>
                <div><StatusBadge status={viewFollowUpModal.followUp.resultingStatus || viewFollowUpModal.followUp.status} /></div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Customer Conversation & Response</div>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.825rem', color: '#0f172a', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                {viewFollowUpModal.followUp.customerResponse || 'No customer response recorded.'}
              </div>
            </div>

            {viewFollowUpModal.followUp.remarks && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Internal Remarks & Strategy</div>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.825rem', color: '#475569', whiteSpace: 'pre-wrap' }}>
                  {viewFollowUpModal.followUp.remarks}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Follow-Up Confirmation Modal */}
      {deleteFollowUpModal.isOpen && deleteFollowUpModal.followUp && (
        <Modal
          isOpen={deleteFollowUpModal.isOpen}
          onClose={() => setDeleteFollowUpModal({ isOpen: false, followUp: null, deleting: false })}
          title="Delete Follow-Up Record"
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteFollowUpModal({ isOpen: false, followUp: null, deleting: false })}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteFollowUp}
                disabled={deleteFollowUpModal.deleting}
                style={{ borderRadius: '8px', fontSize: '0.825rem', backgroundColor: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Trash2 size={14} />
                <span>{deleteFollowUpModal.deleting ? 'Deleting...' : 'Delete Follow-Up'}</span>
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.85rem' }}>Are you sure you want to delete this follow-up record?</div>
                <div style={{ color: '#b91c1c', fontSize: '0.775rem', marginTop: '0.2rem' }}>
                  This action will permanently remove this interaction note from the customer's chronological activity log.
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* View Delivery Challan Modal */}
      {viewChallanModal.isOpen && viewChallanModal.challan && (
        <Modal
          isOpen={viewChallanModal.isOpen}
          onClose={() => setViewChallanModal({ isOpen: false, loading: false, challan: null })}
          title={`Delivery Challan Details: ${viewChallanModal.challan.challanNumber}`}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div>
                {!viewChallanModal.challan.invoiced && (
                  <Link
                    to={`/invoices/create?customerId=${activeCustId}&challanId=${viewChallanModal.challan.id || viewChallanModal.challan._id}`}
                    className="btn btn-primary"
                    style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Receipt size={14} /> Create Tax Invoice
                  </Link>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewChallanModal({ isOpen: false, loading: false, challan: null })}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ fontSize: '0.85rem' }}>
            {/* Header summary strip */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Challan Date</span>
                <strong>{formatDate(viewChallanModal.challan.date || viewChallanModal.challan.challanDate)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Status</span>
                <div style={{ marginTop: '2px' }}><StatusBadge status={viewChallanModal.challan.status || 'Dispatched'} /></div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Ref Quotation</span>
                <strong style={{ color: '#2563eb' }}>{viewChallanModal.challan.refQuotationNo || '—'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Salesperson</span>
                <strong>{viewChallanModal.challan.salesperson || 'Sales Rep'}</strong>
              </div>
            </div>

            {/* Customer & Transport details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <UserCheck size={16} style={{ color: '#2563eb' }} />
                  <span>Customer Destination</span>
                </h4>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewChallanModal.challan.customerName || customer?.name}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem', fontSize: '0.8rem' }}>
                  {viewChallanModal.challan.customerAddress || customer?.shippingAddress || customer?.billingAddress || 'Direct site delivery'}
                </div>
                <div style={{ color: '#475569', marginTop: '0.2rem', fontSize: '0.8rem' }}>
                  Contact: {viewChallanModal.challan.customerContact || customer?.mobile || 'N/A'}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Truck size={16} style={{ color: '#16a34a' }} />
                  <span>Logistics & Vehicle Info</span>
                </h4>
                <div style={{ fontSize: '0.8rem' }}><strong>Delivery Info:</strong> {viewChallanModal.challan.deliveryDetails || 'Direct Dispatch'}</div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                  <strong>Driver:</strong> {viewChallanModal.challan.driverName || '—'} 
                  {viewChallanModal.challan.vehicleNo ? ` (Vehicle: ${viewChallanModal.challan.vehicleNo})` : ''}
                </div>
                {viewChallanModal.challan.remarks && (
                  <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.8rem' }}>
                    <strong>Remarks:</strong> {viewChallanModal.challan.remarks}
                  </div>
                )}
              </div>
            </div>

            {/* Items List */}
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Package size={16} style={{ color: '#d97706' }} />
              <span>Dispatched Material Items ({viewChallanModal.challan.items?.length || 0})</span>
            </h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Product Description</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Quantity</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Unit</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(!viewChallanModal.challan.items || viewChallanModal.challan.items.length === 0) ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>No item details available.</td></tr>
                  ) : (
                    viewChallanModal.challan.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>{item.sku || 'SKU'}</td>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>{item.productName || 'Product'}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{item.quantity}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{item.unit || 'Boxes'}</td>
                        <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>{item.remarks || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Audit Status */}
            {viewChallanModal.challan.finalizedAt && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} />
                <span>
                  Finalized & physical warehouse stock deducted on <strong>{formatDate(viewChallanModal.challan.finalizedAt)}</strong> by {viewChallanModal.challan.finalizedBy || 'System'}.
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* View Payment Modal */}
      {viewPaymentModal.isOpen && viewPaymentModal.payment && (
        <Modal
          isOpen={viewPaymentModal.isOpen}
          onClose={() => setViewPaymentModal({ isOpen: false, payment: null })}
          title={`Payment Receipt: ${viewPaymentModal.payment.receiptNumber}`}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <Link
                to={`/payments/${viewPaymentModal.payment.id || viewPaymentModal.payment._id}`}
                className="btn btn-primary"
                style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={14} /> Full Printable Voucher
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewPaymentModal({ isOpen: false, payment: null })}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Payment Date</span>
                <strong>{formatDate(viewPaymentModal.payment.date)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Payment Mode</span>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  border: '1px solid #bfdbfe'
                }}>
                  {getSafeMode(viewPaymentModal.payment.paymentMode)}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Amount Received</span>
                <strong style={{ color: '#16a34a', fontSize: '1.1rem' }}>{formatCurrency(viewPaymentModal.payment.amount)}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Customer Account</span>
                <strong style={{ color: '#0f172a' }}>{customer.name}</strong>
              </div>
              <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Ref / Cheque / UTR No.</span>
                <strong style={{ color: '#0f172a' }}>{viewPaymentModal.payment.referenceNumber || '—'}</strong>
              </div>
            </div>

            {viewPaymentModal.payment.invoiceNumber && (
              <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Allocated Tax Invoice</span>
                <strong style={{ color: '#2563eb' }}>Invoice #{viewPaymentModal.payment.invoiceNumber}</strong>
              </div>
            )}

            {viewPaymentModal.payment.remarks && (
              <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Payment Notes & Remarks</span>
                <div style={{ color: '#475569', fontSize: '0.8rem' }}>{viewPaymentModal.payment.remarks}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* View Return Modal */}
      {viewReturnModal.isOpen && viewReturnModal.returnItem && (
        <Modal
          isOpen={viewReturnModal.isOpen}
          onClose={() => setViewReturnModal({ isOpen: false, returnItem: null })}
          title={`Sales Return Note: ${viewReturnModal.returnItem.returnNoteNumber}`}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewReturnModal({ isOpen: false, returnItem: null })}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Return Date</span>
                <strong>{formatDate(viewReturnModal.returnItem.date || viewReturnModal.returnItem.returnDate)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Status</span>
                <StatusBadge status={viewReturnModal.returnItem.status || viewReturnModal.returnItem.returnStatus} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Credit / Refund</span>
                <strong style={{ color: '#dc2626', fontSize: '1rem' }}>
                  {formatCurrency(viewReturnModal.returnItem.refundAmount || 0)}
                </strong>
              </div>
            </div>

            <div style={{ padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>RETURNED PRODUCT</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{viewReturnModal.returnItem.productName}</div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <div><strong>SKU:</strong> <span style={{ fontFamily: 'monospace' }}>{viewReturnModal.returnItem.sku}</span></div>
                <div><strong>Quantity:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{viewReturnModal.returnItem.quantity} {viewReturnModal.returnItem.unit}</span></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Ref Invoice No.</span>
                <strong>{viewReturnModal.returnItem.invoiceNumber || '—'}</strong>
              </div>
              <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Ref Challan No.</span>
                <strong>{viewReturnModal.returnItem.challanNumber || '—'}</strong>
              </div>
            </div>

            <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Reason for Return</span>
              <div style={{ color: '#0f172a', fontWeight: 600 }}>{viewReturnModal.returnItem.returnReason || 'Damaged / Customer return'}</div>
              {viewReturnModal.returnItem.remarks && (
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {viewReturnModal.returnItem.remarks}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CustomerDetails;
