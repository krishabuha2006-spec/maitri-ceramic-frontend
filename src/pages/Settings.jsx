import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, Scale, Percent, Printer, Plus, Search, Edit3, Trash2, 
  ToggleLeft, ToggleRight, CheckCircle2, AlertCircle, RefreshCw, X, Save, 
  ShieldCheck, ArrowRight, Layers, FileSpreadsheet
} from 'lucide-react';
import { 
  getUnits, createUnit, updateUnit, deleteUnit, deactivateUnit,
  getTaxPresets, createTaxPreset, updateTaxPreset, deleteTaxPreset, deactivateTaxPreset
} from '../services/masterService';
import StatusBadge from '../components/StatusBadge';

export const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'company';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Synchronize active tab with URL query parameter
  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // --- Company Profile State ---
  const [settings, setSettings] = useState({
    companyName: 'Maitri Ceramic',
    tagline: 'Tiles, Sanitaryware & CP Fittings',
    address: '101-104, Commerce Plaza, Near Circle, Ahmedabad, Gujarat',
    phone: '+91 98250 00000',
    email: 'contact@maitriceramic.com',
    gstin: '24ABCDE1234F1Z9',
    defaultTaxPct: 18,
    bankName: 'HDFC Bank',
    accountNo: '50200012345678',
    ifscCode: 'HDFC0000123',
    branch: 'CG Road Branch'
  });

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleCompanySave = (e) => {
    e.preventDefault();
    showToast('Company profile settings saved successfully!');
  };

  // --- Unit Master State ---
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitFormError, setUnitFormError] = useState('');
  const [unitForm, setUnitForm] = useState({
    unitCode: '',
    unitName: '',
    description: '',
    isDecimalAllowed: true,
    status: 'Active'
  });

  const loadUnits = async () => {
    setLoadingUnits(true);
    try {
      const data = await getUnits();
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUnits(false);
    }
  };

  const handleOpenUnitModal = (unit = null) => {
    setUnitFormError('');
    if (unit) {
      setEditingUnitId(unit.id);
      setUnitForm({
        unitCode: unit.unitCode || '',
        unitName: unit.unitName || '',
        description: unit.description || '',
        isDecimalAllowed: unit.isDecimalAllowed !== false,
        status: unit.status || 'Active'
      });
    } else {
      setEditingUnitId(null);
      setUnitForm({
        unitCode: '',
        unitName: '',
        description: '',
        isDecimalAllowed: true,
        status: 'Active'
      });
    }
    setUnitModalOpen(true);
  };

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    setUnitFormError('');
    if (!unitForm.unitCode.trim()) {
      setUnitFormError('Please provide a Unit Code (e.g. Sq.Ft, Box).');
      return;
    }
    if (!unitForm.unitName.trim()) {
      setUnitFormError('Please provide a Unit Name (e.g. Square Feet).');
      return;
    }

    setSavingUnit(true);
    try {
      if (editingUnitId) {
        await updateUnit(editingUnitId, unitForm);
        showToast(`Unit "${unitForm.unitCode}" updated successfully.`);
      } else {
        await createUnit(unitForm);
        showToast(`Unit "${unitForm.unitCode}" created successfully.`);
      }
      setUnitModalOpen(false);
      loadUnits();
    } catch (err) {
      setUnitFormError(err?.message || 'Failed to save measurement unit.');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleToggleUnitStatus = async (unit) => {
    const newStatus = unit.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await deactivateUnit(unit.id, newStatus);
      showToast(`Unit "${unit.unitCode}" marked as ${newStatus}.`);
      loadUnits();
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleDeleteUnit = async (unit) => {
    if (!window.confirm(`Are you sure you want to delete unit "${unit.unitCode}"?`)) return;
    try {
      await deleteUnit(unit.id);
      showToast(`Unit "${unit.unitCode}" deleted.`);
      loadUnits();
    } catch (err) {
      alert('Failed to delete unit.');
    }
  };

  // --- Tax Master State ---
  const [taxes, setTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const [taxSearch, setTaxSearch] = useState('');
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingTaxId, setEditingTaxId] = useState(null);
  const [savingTax, setSavingTax] = useState(false);
  const [taxFormError, setTaxFormError] = useState('');
  const [taxForm, setTaxForm] = useState({
    name: '',
    gstPct: 18,
    cgstPct: 9,
    sgstPct: 9,
    igstPct: 18,
    cessPct: 0,
    description: '',
    isDefault: false,
    status: 'Active'
  });

  const loadTaxes = async () => {
    setLoadingTaxes(true);
    try {
      const data = await getTaxPresets();
      setTaxes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTaxes(false);
    }
  };

  const handleOpenTaxModal = (preset = null) => {
    setTaxFormError('');
    if (preset) {
      setEditingTaxId(preset.id);
      setTaxForm({
        name: preset.name || '',
        gstPct: preset.gstPct ?? 18,
        cgstPct: preset.cgstPct ?? (preset.gstPct ? preset.gstPct / 2 : 9),
        sgstPct: preset.sgstPct ?? (preset.gstPct ? preset.gstPct / 2 : 9),
        igstPct: preset.igstPct ?? preset.gstPct ?? 18,
        cessPct: preset.cessPct ?? 0,
        description: preset.description || '',
        isDefault: Boolean(preset.isDefault),
        status: preset.status || 'Active'
      });
    } else {
      setEditingTaxId(null);
      setTaxForm({
        name: 'GST 18%',
        gstPct: 18,
        cgstPct: 9,
        sgstPct: 9,
        igstPct: 18,
        cessPct: 0,
        description: '',
        isDefault: false,
        status: 'Active'
      });
    }
    setTaxModalOpen(true);
  };

  const handleGstRateChange = (val) => {
    const rate = Number(val) || 0;
    setTaxForm(prev => ({
      ...prev,
      gstPct: rate,
      cgstPct: rate / 2,
      sgstPct: rate / 2,
      igstPct: rate,
      name: prev.name.startsWith('GST ') || !prev.name ? `GST ${rate}%` : prev.name
    }));
  };

  const handleTaxSubmit = async (e) => {
    e.preventDefault();
    setTaxFormError('');
    if (!taxForm.name.trim()) {
      setTaxFormError('Please enter a Tax Preset Name.');
      return;
    }

    setSavingTax(true);
    try {
      if (editingTaxId) {
        await updateTaxPreset(editingTaxId, taxForm);
        showToast(`Tax preset "${taxForm.name}" updated successfully.`);
      } else {
        await createTaxPreset(taxForm);
        showToast(`Tax preset "${taxForm.name}" created successfully.`);
      }
      setTaxModalOpen(false);
      loadTaxes();
    } catch (err) {
      setTaxFormError(err?.message || 'Failed to save tax preset.');
    } finally {
      setSavingTax(false);
    }
  };

  const handleToggleTaxStatus = async (preset) => {
    const newStatus = preset.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await deactivateTaxPreset(preset.id, newStatus);
      showToast(`Tax preset "${preset.name}" marked as ${newStatus}.`);
      loadTaxes();
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleDeleteTax = async (preset) => {
    if (!window.confirm(`Are you sure you want to delete tax preset "${preset.name}"?`)) return;
    try {
      await deleteTaxPreset(preset.id);
      showToast(`Tax preset "${preset.name}" deleted.`);
      loadTaxes();
    } catch (err) {
      alert('Failed to delete tax preset.');
    }
  };

  // Initial fetch for sub-masters
  useEffect(() => {
    loadUnits();
    loadTaxes();
  }, []);

  const filteredUnits = units.filter(u => 
    (u.unitCode || '').toLowerCase().includes(unitSearch.toLowerCase()) ||
    (u.unitName || '').toLowerCase().includes(unitSearch.toLowerCase()) ||
    (u.description || '').toLowerCase().includes(unitSearch.toLowerCase())
  );

  const filteredTaxes = taxes.filter(t => 
    (t.name || '').toLowerCase().includes(taxSearch.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(taxSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          backgroundColor: '#16a34a',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 8px 20px rgba(22, 163, 74, 0.3)',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>System Masters & Configuration</h2>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
          Manage company branding, measurement units, tax presets, and print quotation formats
        </p>
      </div>

      {/* Master Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        backgroundColor: '#ffffff',
        padding: '0.5rem 0.5rem 0 0.5rem',
        borderRadius: '10px 10px 0 0'
      }}>
        <button
          type="button"
          onClick={() => switchTab('company')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'company' ? 700 : 500,
            color: activeTab === 'company' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'company' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Building2 size={16} />
          <span>Company Profile</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('units')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'units' ? 700 : 500,
            color: activeTab === 'units' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'units' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Scale size={16} />
          <span>Unit Master ({units.length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('tax')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'tax' ? 700 : 500,
            color: activeTab === 'tax' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'tax' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Percent size={16} />
          <span>Tax Master ({taxes.length})</span>
        </button>

        <Link
          to="/quotation-formats"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: '#64748b',
            whiteSpace: 'nowrap'
          }}
        >
          <Printer size={16} />
          <span>Quotation Formats (8)</span>
          <ArrowRight size={13} style={{ color: '#94a3b8' }} />
        </Link>
      </div>

      {/* TAB 1: COMPANY PROFILE */}
      {activeTab === 'company' && (
        <form onSubmit={handleCompanySave}>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              Company Profile & Print Header Settings
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Company Display Name</label>
                <input type="text" name="companyName" className="form-control" value={settings.companyName} onChange={handleCompanyChange} required />
              </div>
              <div className="form-group">
                <label>Business Tagline</label>
                <input type="text" name="tagline" className="form-control" value={settings.tagline} onChange={handleCompanyChange} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Registered Showroom Address</label>
                <input type="text" name="address" className="form-control" value={settings.address} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" name="phone" className="form-control" value={settings.phone} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" name="email" className="form-control" value={settings.email} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>GSTIN Number</label>
                <input type="text" name="gstin" className="form-control" value={settings.gstin} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>Default GST %</label>
                <input type="number" name="defaultTaxPct" className="form-control" value={settings.defaultTaxPct} onChange={handleCompanyChange} />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
              Default Bank Account for Invoices & Receipts
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Bank Name</label>
                <input type="text" name="bankName" className="form-control" value={settings.bankName} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input type="text" name="accountNo" className="form-control" value={settings.accountNo} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>IFSC Code</label>
                <input type="text" name="ifscCode" className="form-control" value={settings.ifscCode} onChange={handleCompanyChange} />
              </div>
              <div className="form-group">
                <label>Branch Name</label>
                <input type="text" name="branch" className="form-control" value={settings.branch} onChange={handleCompanyChange} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontWeight: 600 }}>
              <Save size={16} style={{ marginRight: '0.4rem' }} /> Save Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: UNIT MASTER (MODULE 2) */}
      {activeTab === 'units' && (
        <div>
          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search Unit Code or Name..."
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.8rem', borderRadius: '8px' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenUnitModal()}
              style={{ height: '36px', padding: '0 1rem', fontSize: '0.825rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '8px' }}
            >
              <Plus size={15} /> Add Measurement Unit
            </button>
          </div>

          {/* Units Table */}
          <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Unit Code</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Unit Name</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description / Application</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Decimals</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUnits ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    </td>
                  </tr>
                ) : filteredUnits.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No measurement units found.</td></tr>
                ) : (
                  filteredUnits.map(unit => (
                    <tr key={unit.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#0f172a' }}>
                        <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.75rem' }}>
                          {unit.unitCode}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                        {unit.unitName}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {unit.description || '-'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontSize: '0.8rem' }}>
                        {unit.isDecimalAllowed ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>Allowed</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>Integer Only</span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <StatusBadge status={unit.status || 'Active'} />
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleUnitStatus(unit)}
                            className="btn btn-secondary"
                            title={`Toggle Status (${unit.status})`}
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            {unit.status === 'Active' ? <ToggleRight size={16} color="#16a34a" /> : <ToggleLeft size={16} color="#94a3b8" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenUnitModal(unit)}
                            className="btn btn-secondary"
                            title="Edit Unit"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(unit)}
                            className="btn btn-secondary"
                            title="Delete Unit"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TAX MASTER (MODULE 2) */}
      {activeTab === 'tax' && (
        <div>
          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search Tax Preset Name..."
                value={taxSearch}
                onChange={e => setTaxSearch(e.target.value)}
                style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.8rem', borderRadius: '8px' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenTaxModal()}
              style={{ height: '36px', padding: '0 1rem', fontSize: '0.825rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '8px' }}
            >
              <Plus size={15} /> Add Tax Preset
            </button>
          </div>

          {/* Tax Presets Table */}
          <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tax Preset Name</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>GST Rate</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>CGST</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>SGST</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>IGST</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingTaxes ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    </td>
                  </tr>
                ) : filteredTaxes.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No tax presets found.</td></tr>
                ) : (
                  filteredTaxes.map(tax => (
                    <tr key={tax.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{tax.name}</span>
                          {tax.isDefault && (
                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                        {tax.gstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#475569' }}>
                        {tax.cgstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#475569' }}>
                        {tax.sgstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#475569' }}>
                        {tax.igstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {tax.description || '-'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <StatusBadge status={tax.status || 'Active'} />
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleTaxStatus(tax)}
                            className="btn btn-secondary"
                            title={`Toggle Status (${tax.status})`}
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            {tax.status === 'Active' ? <ToggleRight size={16} color="#16a34a" /> : <ToggleLeft size={16} color="#94a3b8" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTaxModal(tax)}
                            className="btn btn-secondary"
                            title="Edit Tax Preset"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTax(tax)}
                            className="btn btn-secondary"
                            title="Delete Tax Preset"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unit Modal */}
      {unitModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {editingUnitId ? 'Edit Measurement Unit' : 'Create Measurement Unit'}
              </h3>
              <button
                type="button"
                onClick={() => setUnitModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {unitFormError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {unitFormError}
              </div>
            )}

            <form onSubmit={handleUnitSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Unit Code <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Sq.Ft, Box, Pcs"
                    value={unitForm.unitCode}
                    onChange={e => setUnitForm({ ...unitForm, unitCode: e.target.value })}
                    required
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Unit Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Square Feet"
                    value={unitForm.unitName}
                    onChange={e => setUnitForm({ ...unitForm, unitName: e.target.value })}
                    required
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Description / Application
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Usage context for tiles, sanitaryware or adhesives..."
                  value={unitForm.description}
                  onChange={e => setUnitForm({ ...unitForm, description: e.target.value })}
                  style={{ borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="decimalCheck"
                  checked={unitForm.isDecimalAllowed}
                  onChange={e => setUnitForm({ ...unitForm, isDecimalAllowed: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="decimalCheck" style={{ fontSize: '0.825rem', color: '#334155', cursor: 'pointer' }}>
                  Allow decimal quantities (e.g. 12.50 Sq.Ft)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setUnitModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingUnit}
                  style={{ padding: '0.45rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  {savingUnit ? 'Saving...' : (editingUnitId ? 'Update Unit' : 'Create Unit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Modal */}
      {taxModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '540px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {editingTaxId ? 'Edit Tax Preset' : 'Create Tax Preset'}
              </h3>
              <button
                type="button"
                onClick={() => setTaxModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {taxFormError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {taxFormError}
              </div>
            )}

            <form onSubmit={handleTaxSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Preset Display Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. GST 18%"
                    value={taxForm.name}
                    onChange={e => setTaxForm({ ...taxForm, name: e.target.value })}
                    required
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    GST % <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="18"
                    value={taxForm.gstPct}
                    onChange={e => handleGstRateChange(e.target.value)}
                    required
                    style={{ height: '38px', borderRadius: '8px', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Automatic Tax Split Display */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                backgroundColor: '#f8fafc',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '1rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>CGST Rate</span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{taxForm.cgstPct}%</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>SGST Rate</span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{taxForm.sgstPct}%</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>IGST Rate</span>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{taxForm.igstPct}%</strong>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Description / Applicable Commodities
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Standard tiles, sanitary fittings, or adhesive tax rates..."
                  value={taxForm.description}
                  onChange={e => setTaxForm({ ...taxForm, description: e.target.value })}
                  style={{ borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="defaultTaxCheck"
                  checked={taxForm.isDefault}
                  onChange={e => setTaxForm({ ...taxForm, isDefault: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="defaultTaxCheck" style={{ fontSize: '0.825rem', color: '#334155', cursor: 'pointer' }}>
                  Set as default GST preset for new products
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTaxModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingTax}
                  style={{ padding: '0.45rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  {savingTax ? 'Saving...' : (editingTaxId ? 'Update Preset' : 'Create Preset')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
