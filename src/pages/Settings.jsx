import React, { useState } from 'react';

export const Settings = () => {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    alert('System settings saved successfully!');
  };

  return (
    <div style={{ maxWidth: '850px' }}>
      <form onSubmit={handleSave}>
        
        <div className="card">
          <h3 className="card-title">Company Profile & Print Header Settings</h3>
          <div className="form-grid">
            
            <div className="form-group">
              <label>Company Display Name</label>
              <input type="text" name="companyName" className="form-control" value={settings.companyName} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Business Tagline</label>
              <input type="text" name="tagline" className="form-control" value={settings.tagline} onChange={handleChange} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Registered Showroom Address</label>
              <input type="text" name="address" className="form-control" value={settings.address} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" name="phone" className="form-control" value={settings.phone} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input type="email" name="email" className="form-control" value={settings.email} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>GSTIN Number</label>
              <input type="text" name="gstin" className="form-control" value={settings.gstin} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Default GST %</label>
              <input type="number" name="defaultTaxPct" className="form-control" value={settings.defaultTaxPct} onChange={handleChange} />
            </div>

          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Default Bank Account for Invoices & Receipts</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Bank Name</label>
              <input type="text" name="bankName" className="form-control" value={settings.bankName} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Account Number</label>
              <input type="text" name="accountNo" className="form-control" value={settings.accountNo} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>IFSC Code</label>
              <input type="text" name="ifscCode" className="form-control" value={settings.ifscCode} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Branch Name</label>
              <input type="text" name="branch" className="form-control" value={settings.branch} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ marginBottom: '2rem' }}>
          <button type="submit" className="btn btn-primary">Save Settings</button>
        </div>

      </form>
    </div>
  );
};

export default Settings;
