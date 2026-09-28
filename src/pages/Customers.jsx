import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  getCustomers, 
  deleteCustomer, 
  deactivateCustomer, 
  reactivateCustomer, 
  exportCustomerList,
  saveStoredCustomers
} from '../services/customerService';
import { getQuotations, confirmQuotation, cancelQuotation, updateQuotationStatus, exportQuotationDocument } from '../services/quotationService';
import { getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, COMMUNICATION_TYPES, RESULTING_STATUSES } from '../services/followUpService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { 
  Plus, Search, Eye, Edit, Trash2, ToggleLeft, ToggleRight, 
  Download, RefreshCw, CheckCircle2, Users, IndianRupee, AlertCircle, X,
  FileText, PhoneCall, Truck, Receipt, Calendar, MessageSquare,
  ChevronDown, ChevronRight, Check, CheckSquare, ShieldCheck, ShoppingBag,
  Printer, XCircle, Ban
} from 'lucide-react';
import { usePermissions } from '../utils/permissions';

export const Customers = () => {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions('customers');
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState('');
  const [exporting, setExporting] = useState(false);

  // Expandable Customer Dropdown State
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [dropdownTabMap, setDropdownTabMap] = useState({}); // { [customerId]: 'quotations' | 'followups' }
  const [customerQuotationsMap, setCustomerQuotationsMap] = useState({});
  const [customerFollowUpsMap, setCustomerFollowUpsMap] = useState({});
  const [loadingDataFor, setLoadingDataFor] = useState(null);

  // Checklist & Confirmation Modal State
  const [checklistTarget, setChecklistTarget] = useState(null); // { customer, quotation }
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistRemarks, setChecklistRemarks] = useState('');
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  // Status Change Modal State
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    customer: null,
    quotation: null,
    status: 'Customer Interested',
    remarks: '',
    saving: false
  });

  // Cancel Quotation Modal State
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    customer: null,
    quotation: null,
    remarks: '',
    cancelling: false
  });

  // Confirm delete modal state
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null, name: '' });

  // Quick Follow-Up Modal State
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [editingFollowUpId, setEditingFollowUpId] = useState(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // View Follow-Up Modal State
  const [viewFollowUpModal, setViewFollowUpModal] = useState({
    isOpen: false,
    customer: null,
    followUp: null
  });

  // Delete Follow-Up Modal State
  const [deleteFollowUpModal, setDeleteFollowUpModal] = useState({
    isOpen: false,
    customer: null,
    followUp: null,
    deleting: false
  });
  const [followUpForm, setFollowUpForm] = useState({
    quotationId: '',
    communicationType: 'CALL',
    resultingStatus: 'CUSTOMER_INTERESTED',
    followUpDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: '',
    customerResponse: '',
    remarks: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await getCustomers({ search, customerType: typeFilter, status: statusFilter });
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadCustomers();
  }, [search, typeFilter, statusFilter]);

  const toggleCustomerExpand = async (customer) => {
    const custId = customer.id;
    if (expandedCustomerId === custId) {
      setExpandedCustomerId(null);
      return;
    }

    setExpandedCustomerId(custId);
    if (!dropdownTabMap[custId]) {
      setDropdownTabMap(prev => ({ ...prev, [custId]: 'quotations' }));
    }

    // Load quotations & follow-ups for this customer if not already cached
    if (!customerQuotationsMap[custId] || !customerFollowUpsMap[custId]) {
      setLoadingDataFor(custId);
      try {
        const [qtRes, flwRes] = await Promise.all([
          getQuotations({ customerId: custId, customerName: customer.name }).catch(() => ({ data: [] })),
          getFollowUps().catch(() => [])
        ]);

        const rawQuotes = qtRes.data || (Array.isArray(qtRes) ? qtRes : []);
        const rawFlws = Array.isArray(flwRes) ? flwRes : (flwRes?.data || []);
        const quotationIds = new Set(rawQuotes.map(q => String(q.id || q._id)));
        const custName = (customer.name || '').toLowerCase();

        const filteredFlws = rawFlws.filter(f => 
          (f.customerName && f.customerName.toLowerCase() === custName) ||
          (f.customerId && String(f.customerId) === String(custId)) ||
          (f.quotationId && quotationIds.has(String(f.quotationId)))
        );

        setCustomerQuotationsMap(prev => ({ ...prev, [custId]: rawQuotes }));
        setCustomerFollowUpsMap(prev => ({ ...prev, [custId]: filteredFlws }));
      } catch (err) {
        console.error('Failed to load customer details:', err);
        setCustomerQuotationsMap(prev => ({ ...prev, [custId]: [] }));
        setCustomerFollowUpsMap(prev => ({ ...prev, [custId]: [] }));
      } finally {
        setLoadingDataFor(null);
      }
    }
  };

  const handleOpenChecklistModal = (customer, quotation) => {
    setChecklistTarget({ customer, quotation });
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
    const { customer, quotation } = checklistTarget;
    const qId = quotation.id || quotation._id;
    setConfirmingOrder(true);

    try {
      const activeConfirmedItems = checklistItems.filter(i => i.checked);
      const calculatedAmount = activeConfirmedItems.reduce((sum, i) => sum + (i.confirmedQty * i.rate), 0) || Number(quotation.quotationAmount || quotation.grandTotal || 0);

      await confirmQuotation(qId, {
        items: activeConfirmedItems,
        remarks: checklistRemarks,
        finalConfirmedAmount: calculatedAmount
      });

      // 1. Update Quotation in local customer quotations map
      setCustomerQuotationsMap(prev => {
        const list = prev[customer.id] || [];
        return {
          ...prev,
          [customer.id]: list.map(q => (q.id === qId || q._id === qId) ? { ...q, status: 'Confirmed', confirmedAmount: calculatedAmount } : q)
        };
      });

      // 2. Realize Revenue: Update Customer's Total Sales Volume in state & local storage
      setCustomers(prev => {
        const updated = prev.map(c => {
          if (String(c.id) === String(customer.id)) {
            const oldSales = Number(c.totalSales || 0);
            const newSales = oldSales + calculatedAmount;
            return { ...c, totalSales: newSales };
          }
          return c;
        });
        saveStoredCustomers(updated);
        return updated;
      });

      setSuccessToast(`Quotation #${quotation.quotationNumber} confirmed & finalized! Added ${formatCurrency(calculatedAmount)} to Revenue.`);
      setTimeout(() => setSuccessToast(''), 4000);
      setChecklistTarget(null);
    } catch (err) {
      console.error('Order confirmation failed:', err);
    } finally {
      setConfirmingOrder(false);
    }
  };

  const handleDelete = async (id, name) => {
    setConfirmState({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = confirmState;
    setConfirmState({ isOpen: false, id: null, name: '' });
    try {
      await deleteCustomer(id);
      setCustomers(prev => prev.filter(c => String(c.id) !== String(id)));
      setSuccessToast(`Customer "${name}" deleted successfully.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error('Delete customer error:', err);
    }
  };

  const handleToggleStatus = async (id, name, currentIsActive) => {
    try {
      if (currentIsActive) {
        await deactivateCustomer(id);
      } else {
        await reactivateCustomer(id);
      }
      const newStatus = currentIsActive ? 'Inactive' : 'Active';
      setCustomers(prev => prev.map(c => String(c.id) === String(id) ? { ...c, isActive: !currentIsActive, status: newStatus } : c));
      setSuccessToast(`Customer "${name}" status set to ${newStatus}.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error('Toggle customer status error:', err);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportCustomerList({ search, customerType: typeFilter, status: statusFilter });
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Customers_Export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setSuccessToast('Customer directory exported successfully.');
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleOpenFollowUp = (customer, defaultQuotationId = '', existingFollowUp = null) => {
    setFollowUpTarget(customer);
    if (existingFollowUp) {
      setEditingFollowUpId(existingFollowUp.id || existingFollowUp._id);
      setFollowUpForm({
        quotationId: existingFollowUp.quotationId || defaultQuotationId || '',
        communicationType: existingFollowUp.communicationType || 'CALL',
        resultingStatus: existingFollowUp.resultingStatus || existingFollowUp.status || 'CUSTOMER_INTERESTED',
        followUpDate: existingFollowUp.followUpDate ? existingFollowUp.followUpDate.split('T')[0] : new Date().toISOString().split('T')[0],
        nextFollowUpDate: existingFollowUp.nextFollowUpDate ? existingFollowUp.nextFollowUpDate.split('T')[0] : '',
        customerResponse: existingFollowUp.customerResponse || '',
        remarks: existingFollowUp.remarks || ''
      });
    } else {
      setEditingFollowUpId(null);
      setFollowUpForm({
        quotationId: defaultQuotationId,
        communicationType: 'CALL',
        resultingStatus: 'CUSTOMER_INTERESTED',
        followUpDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: '',
        customerResponse: '',
        remarks: ''
      });
    }
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpTarget) return;
    setSavingFollowUp(true);
    try {
      if (editingFollowUpId) {
        const updated = await updateFollowUp(editingFollowUpId, {
          customerId: followUpTarget.id,
          customerName: followUpTarget.name,
          ...followUpForm
        });
        setCustomerFollowUpsMap(prev => ({
          ...prev,
          [followUpTarget.id]: (prev[followUpTarget.id] || []).map(f => (f.id === editingFollowUpId || f._id === editingFollowUpId) ? updated : f)
        }));
        setSuccessToast(`Follow-up record updated for ${followUpTarget.name}`);
      } else {
        const newFollowUp = await createFollowUp({
          customerId: followUpTarget.id,
          customerName: followUpTarget.name,
          ...followUpForm
        });
        setCustomerFollowUpsMap(prev => ({
          ...prev,
          [followUpTarget.id]: [newFollowUp, ...(prev[followUpTarget.id] || [])]
        }));
        setSuccessToast(`Follow-up logged for ${followUpTarget.name}`);
      }

      setTimeout(() => setSuccessToast(''), 3500);
      setFollowUpTarget(null);
      setEditingFollowUpId(null);
    } catch (err) {
      console.error('Failed to log follow-up:', err);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleOpenViewFollowUp = (customer, followUp) => {
    setViewFollowUpModal({
      isOpen: true,
      customer,
      followUp
    });
  };

  const handleOpenDeleteFollowUp = (customer, followUp) => {
    setDeleteFollowUpModal({
      isOpen: true,
      customer,
      followUp,
      deleting: false
    });
  };

  const handleConfirmDeleteFollowUp = async () => {
    if (!deleteFollowUpModal.followUp || !deleteFollowUpModal.customer) return;
    const fId = deleteFollowUpModal.followUp.id || deleteFollowUpModal.followUp._id;
    const cId = deleteFollowUpModal.customer.id;

    setDeleteFollowUpModal(prev => ({ ...prev, deleting: true }));
    try {
      await deleteFollowUp(fId);
      setCustomerFollowUpsMap(prev => ({
        ...prev,
        [cId]: (prev[cId] || []).filter(f => f.id !== fId && f._id !== fId)
      }));
      setSuccessToast('Follow-up record deleted.');
      setTimeout(() => setSuccessToast(''), 3500);
      setDeleteFollowUpModal({ isOpen: false, customer: null, followUp: null, deleting: false });
    } catch (err) {
      setSuccessToast(err.message || 'Failed to delete follow-up');
      setDeleteFollowUpModal(prev => ({ ...prev, deleting: false }));
    }
  };

  const handleOpenStatusModal = (customer, quotation) => {
    setStatusModal({
      isOpen: true,
      customer,
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
    const cust = statusModal.customer;
    const qId = q.id || q._id;
    const newStatus = statusModal.status;
    const oldStatus = q.status;
    const qAmount = Number(q.confirmedAmount || q.quotationAmount || q.grandTotal || 0);

    setStatusModal(prev => ({ ...prev, saving: true }));
    try {
      await updateQuotationStatus(qId, newStatus, statusModal.remarks);

      if (cust) {
        const wasConfirmed = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(oldStatus);
        const isNowConfirmed = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(newStatus);
        
        let delta = 0;
        if (!wasConfirmed && isNowConfirmed) delta = qAmount;
        else if (wasConfirmed && !isNowConfirmed) delta = -qAmount;

        if (delta !== 0) {
          setCustomers(prev => {
            const updated = prev.map(c => {
              if (c.id === cust.id || c._id === cust.id) {
                const currentTotal = Number(c.totalSales || 0);
                return { ...c, totalSales: Math.max(0, currentTotal + delta) };
              }
              return c;
            });
            saveStoredCustomers(updated);
            return updated;
          });
        }
      }

      setCustomerQuotationsMap(prev => ({
        ...prev,
        [cust.id]: (prev[cust.id] || []).map(item => (item.id === qId || item._id === qId) ? { ...item, status: newStatus, remarks: statusModal.remarks || item.remarks } : item)
      }));

      setSuccessToast(`Quotation #${q.quotationNumber} status updated to "${newStatus}"`);
      setTimeout(() => setSuccessToast(''), 3500);
      setStatusModal({ isOpen: false, customer: null, quotation: null, status: 'Draft', remarks: '', saving: false });
    } catch (err) {
      setSuccessToast(err.message || 'Failed to update quotation status');
      setStatusModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleOpenCancelModal = (customer, quotation) => {
    setCancelModal({
      isOpen: true,
      customer,
      quotation,
      remarks: '',
      cancelling: false
    });
  };

  const handleConfirmCancelQuotation = async () => {
    if (!cancelModal.quotation) return;
    const q = cancelModal.quotation;
    const cust = cancelModal.customer;
    const qId = q.id || q._id;
    const wasConfirmed = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(q.status);
    const qAmount = Number(q.confirmedAmount || q.quotationAmount || q.grandTotal || 0);

    setCancelModal(prev => ({ ...prev, cancelling: true }));
    try {
      await cancelQuotation(qId);

      if (cust && wasConfirmed) {
        setCustomers(prev => {
          const updated = prev.map(c => {
            if (c.id === cust.id || c._id === cust.id) {
              const currentTotal = Number(c.totalSales || 0);
              return { ...c, totalSales: Math.max(0, currentTotal - qAmount) };
            }
            return c;
          });
          saveStoredCustomers(updated);
          return updated;
        });
      }

      setCustomerQuotationsMap(prev => ({
        ...prev,
        [cust.id]: (prev[cust.id] || []).map(item => (item.id === qId || item._id === qId) ? { ...item, status: 'Cancelled' } : item)
      }));

      setSuccessToast(`Quotation #${q.quotationNumber} has been cancelled.`);
      setTimeout(() => setSuccessToast(''), 3500);
      setCancelModal({ isOpen: false, customer: null, quotation: null, remarks: '', cancelling: false });
    } catch (err) {
      setSuccessToast(err.message || 'Failed to cancel quotation');
      setCancelModal(prev => ({ ...prev, cancelling: false }));
    }
  };

  const handleDownloadPdf = async (quotation) => {
    try {
      setSuccessToast(`Generating Quotation PDF for #${quotation.quotationNumber}...`);
      await exportQuotationDocument(quotation.id || quotation._id, 'pdf', quotation.quotationNumber, quotation);
    } catch (err) {
      setSuccessToast('Error exporting quotation PDF');
    }
  };

  // Summary Metrics
  const totalCustomers = customers.length;
  const totalOutstandingSum = customers.reduce((sum, c) => sum + Number(c.totalOutstanding || 0), 0);
  const totalSalesSum = customers.reduce((sum, c) => sum + Number(c.totalSales || 0), 0);
  const activeCount = customers.filter(c => c.isActive !== false).length;

  return (
    <div style={{ paddingBottom: '2.5rem', width: '100%', maxWidth: '100%' }}>
      {/* Toast Notification */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={24} style={{ color: '#2563eb' }} />
            Customer Directory & Operations Hub
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Select any customer to view Quotations & Follow-Ups. Finalized quotations directly update verified sales revenue.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-secondary"
            style={{
              borderRadius: '9px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.825rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Download size={15} />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          {canCreate && (
            <Link
              to="/customers/new"
              className="btn btn-primary"
              style={{
                borderRadius: '9px',
                padding: '0.55rem 1.1rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Plus size={16} />
              <span>Add Customer</span>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '0.6rem', borderRadius: '8px', color: '#2563eb' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Customers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{totalCustomers}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '8px', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Profiles</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{activeCount}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#fdf2f8', padding: '0.6rem', borderRadius: '8px', color: '#db2777' }}>
            <IndianRupee size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Confirmed Sales Volume</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalSalesSum)}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#fef2f2', padding: '0.6rem', borderRadius: '8px', color: '#dc2626' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Outstanding</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(totalOutstandingSum)}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container" style={{ width: '100%', overflow: 'hidden' }}>
        {/* Filter Bar */}
        <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 280px', maxWidth: '420px' }}>
            <Search size={16} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by Name, Mobile, City, GST..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.825rem', width: '100%' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}>
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: '150px', height: '38px', borderRadius: '8px', fontSize: '0.825rem', flexShrink: 0 }}
            >
              <option value="">All Types</option>
              <option value="RETAIL">Retail</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="BUILDER">Builder</option>
              <option value="ARCHITECT">Architect</option>
              <option value="WHOLESALER">Wholesaler</option>
            </select>

            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '130px', height: '38px', borderRadius: '8px', fontSize: '0.825rem', flexShrink: 0 }}
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.6rem 0.5rem', width: '38px', textAlign: 'center' }}></th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Customer Name</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, width: '90px' }}>Type</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, width: '110px' }}>Mobile</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, width: '120px' }}>City / State</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, width: '125px' }}>GST Number</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, textAlign: 'right', width: '100px' }}>Sales</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, textAlign: 'right', width: '105px' }}>Outstanding</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, textAlign: 'center', width: '85px' }}>Status</th>
                <th style={{ padding: '0.6rem 0.65rem', fontWeight: 700, textAlign: 'center', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No customers found matching search filters.
                  </td>
                </tr>
              ) : (
                customers
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(c => {
                    const isExpanded = expandedCustomerId === c.id;
                    const activeSubTab = dropdownTabMap[c.id] || 'quotations';
                    const custQuotes = customerQuotationsMap[c.id] || [];
                    const custFollowUps = customerFollowUpsMap[c.id] || [];
                    const isLoadingThis = loadingDataFor === c.id;

                    return (
                      <React.Fragment key={c.id}>
                        <tr 
                          style={{ 
                            borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                            backgroundColor: isExpanded ? '#f8fafc' : 'transparent',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Chevron Toggle with Right Tooltip */}
                          <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              onClick={() => toggleCustomerExpand(c)}
                              data-tooltip={isExpanded ? 'Hide Customer Activity' : 'View Quotations & Follow-Ups'}
                              data-tooltip-pos="right"
                              style={{
                                border: 'none',
                                background: isExpanded ? '#dbeafe' : '#f1f5f9',
                                color: isExpanded ? '#2563eb' : '#64748b',
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>

                          <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle', fontWeight: 700, color: '#0f172a' }}>
                            <div 
                              onClick={() => toggleCustomerExpand(c)} 
                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <span>{c.name}</span>
                            </div>
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              padding: '0.12rem 0.4rem',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1'
                            }}>
                              {c.customerType || 'RETAIL'}
                            </span>
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', color: '#334155', fontWeight: 500 }}>
                            {c.mobile}
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', color: '#64748b' }}>
                            {c.city ? `${c.city}, ${c.state || ''}` : '-'}
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                            {c.gstNumber || '-'}
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                            {formatCurrency(c.totalSales)}
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, color: c.totalOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                            {formatCurrency(c.totalOutstanding)}
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', textAlign: 'center' }}>
                            <StatusBadge status={c.status} />
                          </td>

                          <td style={{ padding: '0.6rem 0.65rem', verticalAlign: 'middle', textAlign: 'center' }}>
                            <div className="action-btn-group" style={{ justifyContent: 'center', gap: '0.3rem', flexWrap: 'nowrap' }}>
                              {/* 1. 360 Hub View */}
                              <Link 
                                to={`/customers/${c.id}`} 
                                className="action-btn action-btn-view" 
                                data-tooltip="Customer 360° Hub"
                                style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                              >
                                <Eye size={14} />
                              </Link>

                              {/* 2. Quick + Quote */}
                              <Link 
                                to={`/quotations/create?customerId=${c.id}`} 
                                className="action-btn" 
                                data-tooltip="Create Quotation"
                                style={{ backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
                              >
                                <FileText size={14} />
                              </Link>

                              {/* 3. Quick Follow-Up Popup */}
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleOpenFollowUp(c)}
                                data-tooltip="Log Follow-Up"
                                style={{ backgroundColor: '#faf5ff', color: '#9333ea', borderColor: '#e9d5ff' }}
                              >
                                <PhoneCall size={14} />
                              </button>

                              {/* 4. Quick + Challan */}
                              <Link 
                                to={`/challans/create?customerId=${c.id}`} 
                                className="action-btn" 
                                data-tooltip="Dispatch Challan"
                                style={{ backgroundColor: '#fff7ed', color: '#ea580c', borderColor: '#fed7aa' }}
                              >
                                <Truck size={14} />
                              </Link>

                              {/* 5. Quick + Invoice */}
                              <Link 
                                to={`/invoices/create?customerId=${c.id}`} 
                                className="action-btn" 
                                data-tooltip="Create Invoice"
                                style={{ backgroundColor: '#fdf2f8', color: '#db2777', borderColor: '#fbcfe8' }}
                              >
                                <Receipt size={14} />
                              </Link>

                              {/* Edit Profile */}
                              {canEdit && (
                                <Link 
                                  to={`/customers/edit/${c.id}`} 
                                  className="action-btn action-btn-edit" 
                                  data-tooltip="Edit Profile"
                                >
                                  <Edit size={14} />
                                </Link>
                              )}

                              {/* Toggle Active */}
                              {canEdit && (
                                <button
                                  type="button"
                                  className="action-btn action-btn-toggle"
                                  onClick={() => handleToggleStatus(c.id, c.name, c.isActive !== false)}
                                  data-tooltip={c.isActive !== false ? 'Deactivate' : 'Activate'}
                                >
                                  {c.isActive !== false ? (
                                    <ToggleRight size={16} style={{ color: '#16a34a' }} />
                                  ) : (
                                    <ToggleLeft size={16} style={{ color: '#94a3b8' }} />
                                  )}
                                </button>
                              )}

                              {/* Delete */}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="action-btn action-btn-delete"
                                  onClick={() => handleDelete(c.id, c.name)}
                                  data-tooltip="Delete Customer"
                                  style={{ color: '#dc2626' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Customer Activity Dropdown Sub-Row */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <td colSpan="10" style={{ padding: '0.85rem 1.25rem 1.25rem 1.25rem' }}>
                              <div style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                padding: '1rem',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
                              }}>
                                {/* Dropdown Header with Sub-Tabs */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.65rem' }}>
                                  {/* Sub-Tabs: Quotations vs Follow-ups */}
                                  <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setDropdownTabMap(prev => ({ ...prev, [c.id]: 'quotations' }))}
                                      style={{
                                        border: 'none',
                                        backgroundColor: activeSubTab === 'quotations' ? '#ffffff' : 'transparent',
                                        color: activeSubTab === 'quotations' ? '#2563eb' : '#64748b',
                                        fontWeight: activeSubTab === 'quotations' ? 700 : 600,
                                        fontSize: '0.8rem',
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        boxShadow: activeSubTab === 'quotations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <FileText size={14} />
                                      <span>Quotations</span>
                                      <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: '10px', backgroundColor: activeSubTab === 'quotations' ? '#eff6ff' : '#e2e8f0' }}>
                                        {custQuotes.length}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setDropdownTabMap(prev => ({ ...prev, [c.id]: 'followups' }))}
                                      style={{
                                        border: 'none',
                                        backgroundColor: activeSubTab === 'followups' ? '#ffffff' : 'transparent',
                                        color: activeSubTab === 'followups' ? '#9333ea' : '#64748b',
                                        fontWeight: activeSubTab === 'followups' ? 700 : 600,
                                        fontSize: '0.8rem',
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        boxShadow: activeSubTab === 'followups' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <PhoneCall size={14} />
                                      <span>Follow-Ups</span>
                                      <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.4rem', borderRadius: '10px', backgroundColor: activeSubTab === 'followups' ? '#faf5ff' : '#e2e8f0', color: activeSubTab === 'followups' ? '#9333ea' : '#64748b' }}>
                                        {custFollowUps.length}
                                      </span>
                                    </button>
                                  </div>

                                  {/* Right Actions */}
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {activeSubTab === 'quotations' ? (
                                      <Link 
                                        to={`/quotations/create?customerId=${c.id}`} 
                                        className="btn btn-primary btn-sm"
                                        style={{ borderRadius: '6px', fontSize: '0.775rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                      >
                                        <Plus size={13} />
                                        <span>New Quotation</span>
                                      </Link>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenFollowUp(c)}
                                        className="btn btn-primary btn-sm"
                                        style={{ borderRadius: '6px', fontSize: '0.775rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#9333ea', borderColor: '#9333ea' }}
                                      >
                                        <PhoneCall size={13} />
                                        <span>Log Follow-Up</span>
                                      </button>
                                    )}

                                    <Link 
                                      to={`/customers/${c.id}?tab=${activeSubTab}`} 
                                      className="btn btn-secondary btn-sm"
                                      style={{ borderRadius: '6px', fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}
                                    >
                                      Open 360° Hub
                                    </Link>
                                  </div>
                                </div>

                                {isLoadingThis ? (
                                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                                    <span>Fetching customer history...</span>
                                  </div>
                                ) : activeSubTab === 'quotations' ? (
                                  /* Quotations Sub-Tab Content */
                                  custQuotes.length === 0 ? (
                                    <div style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.825rem' }}>
                                      No quotations created for this customer yet. 
                                      <Link to={`/quotations/create?customerId=${c.id}`} style={{ color: '#2563eb', fontWeight: 600, marginLeft: '0.4rem', textDecoration: 'none' }}>
                                        + Create First Quotation
                                      </Link>
                                    </div>
                                  ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Quotation No.</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Type</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>Quoted / Confirmed Amount</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Status / Confirmation</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, width: '320px' }}>Order Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {custQuotes.map(q => {
                                            const isFinalized = ['Confirmed', 'Finalized', 'Won', 'Approved'].includes(q.status);
                                            const isCancelled = ['Cancelled', 'Rejected'].includes(q.status);

                                            return (
                                              <tr key={q.id || q._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                                                  <Link to={`/quotations/${q.id || q._id}`} style={{ color: '#2563eb', textDecoration: 'none' }} data-tooltip="View Quotation">
                                                    {q.quotationNumber}
                                                  </Link>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', color: '#475569' }}>
                                                  {formatDate(q.date)}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', color: '#64748b' }}>
                                                  {q.quotationType || 'STANDARD'}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 700, color: isFinalized ? '#16a34a' : (isCancelled ? '#dc2626' : '#0f172a') }}>
                                                  {formatCurrency(q.confirmedAmount || q.quotationAmount || q.grandTotal)}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                  {isFinalized ? (
                                                    <span style={{
                                                      backgroundColor: '#f0fdf4',
                                                      color: '#16a34a',
                                                      border: '1px solid #bbf7d0',
                                                      padding: '0.2rem 0.6rem',
                                                      borderRadius: '6px',
                                                      fontWeight: 700,
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '0.35rem',
                                                      fontSize: '0.75rem'
                                                    }}>
                                                      <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                                                      <span>✓ Finalized / Confirmed</span>
                                                    </span>
                                                  ) : (
                                                    <StatusBadge status={q.status} />
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
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

                                                    {/* 2. Checklist / Confirm Button if not yet finalized, else Dispatch */}
                                                    {!isFinalized && !isCancelled ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenChecklistModal(c, q)}
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
                                                    ) : isFinalized ? (
                                                      <Link 
                                                        to={`/challans/create?customerId=${c.id}&quotationId=${q.id || q._id}`}
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
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenStatusModal(c, q)}
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
                                                    <button
                                                      type="button"
                                                      className="action-btn"
                                                      onClick={() => handleOpenFollowUp(c, q.id || q._id)}
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

                                                    {/* 6. Create Tax Invoice */}
                                                    <Link 
                                                      to={`/invoices/create?customerId=${c.id}&quotationId=${q.id || q._id}`}
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

                                                    {/* 7. Cancel Quotation */}
                                                    {!isCancelled && (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenCancelModal(c, q)}
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
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )
                                ) : (
                                  /* Follow-Ups Sub-Tab Content */
                                  custFollowUps.length === 0 ? (
                                    <div style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.825rem' }}>
                                      No follow-up logs recorded for this customer yet. 
                                      <button 
                                        type="button" 
                                        onClick={() => handleOpenFollowUp(c)} 
                                        style={{ border: 'none', background: 'none', color: '#9333ea', fontWeight: 600, marginLeft: '0.4rem', cursor: 'pointer' }}
                                      >
                                        + Log First Follow-Up
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Follow-Up Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Mode</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Quotation Ref</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Conversation / Notes</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Next Scheduled Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>Resulting Status</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, width: '120px' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {custFollowUps.map((f, idx) => {
                                            const isWon = String(f.resultingStatus || '').toUpperCase().includes('WON') || String(f.status || '').toUpperCase().includes('CONFIRM');

                                            return (
                                              <tr key={f.id || f._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontWeight: 600, color: '#0f172a' }}>
                                                  {formatDate(f.followUpDate || f.date)}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                                  <span style={{
                                                    padding: '0.15rem 0.45rem',
                                                    borderRadius: '5px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    display: 'inline-block',
                                                    backgroundColor: f.communicationType === 'WHATSAPP' ? '#f0fdf4' : f.communicationType === 'CALL' ? '#eff6ff' : '#f8fafc',
                                                    color: f.communicationType === 'WHATSAPP' ? '#16a34a' : f.communicationType === 'CALL' ? '#2563eb' : '#475569',
                                                    border: '1px solid #cbd5e1'
                                                  }}>
                                                    {f.communicationType || 'CALL'}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontFamily: 'monospace', color: '#64748b' }}>
                                                  {f.quotationNumber || f.quotationId ? `QT-${String(f.quotationId || f.quotationNumber).slice(-6)}` : 'General'}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'left', verticalAlign: 'middle', color: '#334155', maxWidth: '280px' }}>
                                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.customerResponse || f.remarks || '-'}</div>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontWeight: 600, color: f.nextFollowUpDate ? '#d97706' : '#64748b' }}>
                                                  {f.nextFollowUpDate ? formatDate(f.nextFollowUpDate) : '-'}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                                  {isWon ? (
                                                    <span style={{
                                                      backgroundColor: '#f0fdf4',
                                                      color: '#16a34a',
                                                      border: '1px solid #bbf7d0',
                                                      padding: '0.15rem 0.5rem',
                                                      borderRadius: '6px',
                                                      fontWeight: 700,
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '0.3rem',
                                                      fontSize: '0.725rem'
                                                    }}>
                                                      <CheckCircle2 size={13} />
                                                      <span>✓ Finalized / Won</span>
                                                    </span>
                                                  ) : (
                                                    <StatusBadge status={f.resultingStatus || f.status || 'Active'} />
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                  <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'center' }}>
                                                    {/* View */}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenViewFollowUp(c, f)}
                                                      className="action-btn"
                                                      data-tooltip="View Interaction History"
                                                      style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#eff6ff',
                                                        color: '#2563eb',
                                                        border: '1px solid #bfdbfe'
                                                      }}
                                                    >
                                                      <Eye size={13} />
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenFollowUp(c, f.quotationId || '', f)}
                                                      className="action-btn"
                                                      data-tooltip="Edit Follow-Up"
                                                      style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#f0fdf4',
                                                        color: '#16a34a',
                                                        border: '1px solid #bbf7d0'
                                                      }}
                                                    >
                                                      <Edit size={13} />
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenDeleteFollowUp(c, f)}
                                                      className="action-btn"
                                                      data-tooltip="Delete Follow-Up"
                                                      style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#fef2f2',
                                                        color: '#dc2626',
                                                        border: '1px solid #fecaca'
                                                      }}
                                                    >
                                                      <Trash2 size={13} />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={customers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Order Checklist & Finalize Confirmation Modal */}
      {checklistTarget && (
        <Modal
          isOpen={Boolean(checklistTarget)}
          onClose={() => setChecklistTarget(null)}
          title={`Order Checklist & Final Confirmation — ${checklistTarget.quotation?.quotationNumber}`}
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
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{checklistTarget.customer.name} ({checklistTarget.customer.mobile})</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>QUOTATION DATE</span>
                <div style={{ fontWeight: 600, color: '#475569' }}>{formatDate(checklistTarget.quotation.date)}</div>
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

      {/* Quick Follow-Up Modal from Directory */}
      {followUpTarget && (
        <Modal
          isOpen={Boolean(followUpTarget)}
          onClose={() => setFollowUpTarget(null)}
          title={`Log Quick Follow-Up — ${followUpTarget.name}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setFollowUpTarget(null)}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveFollowUp}
                disabled={savingFollowUp}
                style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <PhoneCall size={14} />
                <span>{savingFollowUp ? 'Saving...' : (editingFollowUpId ? 'Update Follow-Up' : 'Save Follow-Up')}</span>
              </button>
            </div>
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
                  {COMMUNICATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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

      {/* Confirm Delete Modal */}
            {/* Quick Status Update Modal */}
      {statusModal.isOpen && statusModal.quotation && (
        <Modal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false, customer: null, quotation: null }))}
          title={`Update Status — Quotation #${statusModal.quotation.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false, customer: null, quotation: null }))}
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
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CUSTOMER</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{statusModal.customer?.name}</div>
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
          onClose={() => setCancelModal(prev => ({ ...prev, isOpen: false, customer: null, quotation: null }))}
          title={`Cancel Quotation — #${cancelModal.quotation.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setCancelModal(prev => ({ ...prev, isOpen: false, customer: null, quotation: null }))}
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
          onClose={() => setViewFollowUpModal({ isOpen: false, customer: null, followUp: null })}
          title="Follow-Up Interaction Details & History"
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setViewFollowUpModal({ isOpen: false, customer: null, followUp: null })}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const targetCust = viewFollowUpModal.customer;
                  const targetFlw = viewFollowUpModal.followUp;
                  setViewFollowUpModal({ isOpen: false, customer: null, followUp: null });
                  handleOpenFollowUp(targetCust, targetFlw.quotationId || '', targetFlw);
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
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewFollowUpModal.customer?.name}</div>
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
          onClose={() => setDeleteFollowUpModal({ isOpen: false, customer: null, followUp: null, deleting: false })}
          title="Delete Follow-Up Record"
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setDeleteFollowUpModal({ isOpen: false, customer: null, followUp: null, deleting: false })}
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

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Delete Customer"
        message={`Are you sure you want to permanently delete "${confirmState.name}"? This action cannot be undone.`}
        confirmLabel="Delete Customer"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, id: null, name: '' })}
        danger
      />
    </div>
  );
};

export default Customers;
