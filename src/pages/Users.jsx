import React, { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, deactivateUser, resetUserPassword } from '../services/userService';
import { ROLES, MODULE_LIST, DEFAULT_ROLE_PERMISSIONS, normalizePermissions, getEmptyPermissions } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  Plus, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle, Save,
  UserCheck, Shield, Lock, CheckSquare, RefreshCcw, User, Edit3, Trash2, Eye, EyeOff, X
} from 'lucide-react';

export const Users = () => {
  const { currentUser, updateCurrentUserPermissions } = useAuth();
  const userRole = currentUser?.role;
  const userPerms = currentUser?.permissions;
  const isSuperAdmin = !userRole || userRole === ROLES.SUPER_ADMIN;
  const canCreateUser = isSuperAdmin || (userPerms?.users?.create ?? false);
  const canEditUser = isSuperAdmin || (userPerms?.users?.edit ?? false);
  const canDeleteUser = isSuperAdmin || (userPerms?.users?.delete ?? false);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLiveApi, setIsLiveApi] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Page mode: false = directory table list, true = full page 1020px form
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  // Reset Password Modal state
  const [resetModal, setResetModal] = useState({ open: false, userId: null, userName: '' });
  const [resetPwd, setResetPwd] = useState({ newPassword: '', confirmPassword: '' });
  const [resetPwdError, setResetPwdError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Form State - Starts completely empty (no prefill)
  const [showNewUserPwd, setShowNewUserPwd] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    role: ROLES.SALES_EXECUTIVE,
    status: 'Active',
    permissions: getEmptyPermissions()
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getUsers();
      if (res.data && res.data.length > 0) {
        setUsers(res.data);
        setIsLiveApi(!!res.isLive);
      } else if (res.isLive) {
        // Backend returned empty — clear list
        setUsers([]);
        setIsLiveApi(true);
      }
      // If isLive=false (backend failed), keep existing users in state
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Open Form for Adding New User - Start completely empty
  const handleAddNew = () => {
    setEditingUserId(null);
    setFormError('');
    setShowNewUserPwd(false);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      password: '',
      role: ROLES.SALES_EXECUTIVE,
      status: 'Active',
      permissions: getEmptyPermissions()
    });
    setShowForm(true);
  };

  // Open Form for Editing Existing User
  const handleEditUser = (user) => {
    setEditingUserId(user.id);
    setFormError('');
    
    const userRole = user.role || ROLES.SALES_EXECUTIVE;
    let customPerms = null;
    try {
      const byId = localStorage.getItem(`maitri_user_perms_${user.id}`);
      const byEmail = user.email ? localStorage.getItem(`maitri_user_perms_${user.email}`) : null;
      const byMobile = (user.mobile && user.mobile !== '-') ? localStorage.getItem(`maitri_user_perms_${user.mobile}`) : null;
      const found = byId || byEmail || byMobile;
      if (found) customPerms = JSON.parse(found);
    } catch (e) {}

    const rawPerms = customPerms || user.permissions;
    const currentPerms = rawPerms && Object.keys(rawPerms).length > 0
      ? normalizePermissions(rawPerms, userRole, false)
      : getEmptyPermissions();

    setFormData({
      name: user.name || '',
      email: user.email || '',
      mobile: user.mobile === '-' ? '' : (user.mobile || ''),
      role: userRole,
      status: user.status || 'Active',
      permissions: currentPerms
    });
    setShowForm(true);
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteUser(id);
      setSuccessToast(`User "${name}" deleted successfully.`);
      setTimeout(() => setSuccessToast(''), 2000);
      loadUsers();
    } catch (err) {
      const errMsg = err?.message || 'Failed to delete user.';
      setFormError(errMsg);
      setTimeout(() => setFormError(''), 4000);
    }
  };

  const handleDeactivateUser = async (id, name, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await deactivateUser(id, newStatus);
      // Optimistically update local state immediately
      setUsers(prev => prev.map(u =>
        String(u.id) === String(id) ? { ...u, status: newStatus } : u
      ));
      setSuccessToast(`User "${name}" is now ${newStatus}.`);
      setTimeout(() => setSuccessToast(''), 2500);
    } catch (err) {
      const errMsg = err?.message || 'Failed to update user status.';
      setFormError(errMsg);
      setTimeout(() => setFormError(''), 4000);
    }
  };

  const handleResetPassword = (id, name) => {
    setResetModal({ open: true, userId: id, userName: name });
    setResetPwd({ newPassword: '', confirmPassword: '' });
    setResetPwdError('');
    setShowPwd(false);
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetPwd.newPassword || resetPwd.newPassword.length < 6) {
      setResetPwdError('Password must be at least 6 characters.');
      return;
    }
    if (resetPwd.newPassword !== resetPwd.confirmPassword) {
      setResetPwdError('Passwords do not match.');
      return;
    }
    setResetting(true);
    setResetPwdError('');
    try {
      const res = await resetUserPassword(resetModal.userId, {
        newPassword: resetPwd.newPassword,
        confirmPassword: resetPwd.confirmPassword
      });
      setResetModal({ open: false, userId: null, userName: '' });
      setSuccessToast(res?.message || `Password reset successfully for ${resetModal.userName}.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      setResetPwdError(err?.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  // Change Role Preset -> Updates role label without overwriting user-selected checkboxes
  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    setFormData(prev => ({
      ...prev,
      role: selectedRole
    }));
  };

  // Toggle specific action (view, create, edit, delete) for a module
  const handlePermissionToggle = (moduleId, actionKey) => {
    setFormData(prev => {
      const currentMod = prev.permissions[moduleId] || { view: false, create: false, edit: false, delete: false };
      const updatedMod = { ...currentMod, [actionKey]: !currentMod[actionKey] };

      // If turning off 'view', turn off create, edit, delete too
      if (actionKey === 'view' && !updatedMod.view) {
        updatedMod.create = false;
        updatedMod.edit = false;
        updatedMod.delete = false;
      }
      // If turning on create/edit/delete, ensure 'view' is also turned on
      if ((actionKey === 'create' || actionKey === 'edit' || actionKey === 'delete') && updatedMod[actionKey]) {
        updatedMod.view = true;
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: updatedMod
        }
      };
    });
  };

  // Master module toggle: Enable/Disable all actions for a module
  const handleModuleMasterToggle = (moduleId) => {
    setFormData(prev => {
      const currentMod = prev.permissions[moduleId] || { view: false, create: false, edit: false, delete: false };
      const isCurrentlyActive = currentMod.view || currentMod.create || currentMod.edit || currentMod.delete;
      
      const updatedMod = isCurrentlyActive 
        ? { view: false, create: false, edit: false, delete: false }
        : { view: true, create: true, edit: true, delete: false };

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: updatedMod
        }
      };
    });
  };

  // Quick Action: Select All Permissions
  const handleSelectAll = () => {
    const allPerms = {};
    MODULE_LIST.forEach(mod => {
      allPerms[mod.id] = { view: true, create: true, edit: true, delete: true };
    });
    setFormData(prev => ({ ...prev, permissions: allPerms }));
  };

  // Quick Action: Read-Only Access
  const handleReadOnly = () => {
    const readOnlyPerms = {};
    MODULE_LIST.forEach(mod => {
      readOnlyPerms[mod.id] = { view: true, create: false, edit: false, delete: false };
    });
    setFormData(prev => ({ ...prev, permissions: readOnlyPerms }));
  };

  // Quick Action: Clear All
  const handleClearAll = () => {
    const clearPerms = {};
    MODULE_LIST.forEach(mod => {
      clearPerms[mod.id] = { view: false, create: false, edit: false, delete: false };
    });
    setFormData(prev => ({ ...prev, permissions: clearPerms }));
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter staff full name.');
      return;
    }
    if (!formData.mobile.trim()) {
      setFormError('Please enter mobile contact number.');
      return;
    }
    if (!editingUserId) {
      if (!formData.password || formData.password.trim().length < 6) {
        setFormError('Password is required for new user (minimum 6 characters).');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingUserId) {
        await updateUser(editingUserId, formData);
        if (updateCurrentUserPermissions) {
          updateCurrentUserPermissions(editingUserId, formData.permissions);
        }
        setSuccessToast(`User profile and permissions updated for ${formData.name}!`);
      } else {
        const created = await createUser(formData);
        if (created?.id && updateCurrentUserPermissions) {
          updateCurrentUserPermissions(created.id, formData.permissions);
        }
        setSuccessToast(`New staff user ${formData.name} created with assigned permissions!`);
      }
      
      setTimeout(() => {
        setSuccessToast('');
      }, 3500);

      setShowForm(false);
      loadUsers();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to save staff user permissions.');
    } finally {
      setSaving(false);
    }
  };

  // Helper function to summarize permissions for table badge
  const getPermissionSummary = (user) => {
    if (user.role === ROLES.SUPER_ADMIN) return 'Full System Access';
    if (!user.permissions) return 'Role Default Access';
    
    const activeCount = Object.values(user.permissions).filter(p => p && p.view).length;
    return `${activeCount} / ${MODULE_LIST.length} Modules Active`;
  };

  // Render Full Page Form (1020px layout matching CreateChallan / PaymentEntry)
  if (showForm) {
    return (
      <div style={{ maxWidth: '1020px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
        {/* Toast Notification */}
        {successToast && (
          <div className="app-toast">
            <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            onClick={() => setShowForm(false)} 
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '10px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Users</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {editingUserId ? 'Edit Staff User & Permissions' : 'Add New Staff User & Assign Permissions'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              Define staff contact profile, access role preset, and user-wise module permissions.
            </p>
          </div>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#991b1b',
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1 Card: Staff Profile & Role Selection */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            padding: '1.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              paddingBottom: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Staff Profile & Account Role
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Basic identity details, mobile contact, primary role designation, and account status
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
              {/* Full Name */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Staff Full Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Mobile Number */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Mobile Contact Number <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Mobile Number"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  required
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Email Address */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Password (Required for New User) */}
              {!editingUserId && (
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Login Password <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewUserPwd ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Enter at least 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      style={{ height: '44px', borderRadius: '8px', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPwd(v => !v)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
                      }}
                    >
                      {showNewUserPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* System Access Role */}
              <div style={{ gridColumn: !editingUserId ? 'span 6' : 'span 3' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Assigned Role Preset <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.role}
                  onChange={handleRoleChange}
                  style={{ height: '44px', borderRadius: '8px', fontWeight: 600, color: '#0f172a' }}
                >
                  {Object.values(ROLES).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {/* Account Status */}
              <div style={{ gridColumn: !editingUserId ? 'span 6' : 'span 3' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Account Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px', fontWeight: 600 }}
                >
                  <option value="Active">Active Access</option>
                  <option value="Inactive">Inactive / Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 Card: User-Wise Permissions Matrix */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            padding: '1.75rem',
            marginBottom: '1.75rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '1rem',
              marginBottom: '1.25rem',
              borderBottom: '1px solid #f1f5f9',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    User-Wise Module Access Permissions
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                    Select only the modules and actions this staff member should have access to. Unselected modules will not appear in their sidebar.
                  </p>
                </div>
              </div>

              {/* Quick Preset Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.775rem', padding: '0.4rem 0.75rem', borderRadius: '6px' }}
                >
                  <CheckSquare size={14} style={{ marginRight: '0.3rem' }} />
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleReadOnly}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.775rem', padding: '0.4rem 0.75rem', borderRadius: '6px' }}
                >
                  <Shield size={14} style={{ marginRight: '0.3rem' }} />
                  View Only
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.775rem', padding: '0.4rem 0.75rem', borderRadius: '6px', color: '#dc2626' }}
                >
                  <RefreshCcw size={14} style={{ marginRight: '0.3rem' }} />
                  Clear All
                </button>
              </div>
            </div>

            {/* Permission Grid Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {MODULE_LIST.map((mod) => {
                const modPerm = formData.permissions[mod.id] || { view: false, create: false, edit: false, delete: false };
                const isModuleEnabled = modPerm.view || modPerm.create || modPerm.edit || modPerm.delete;

                return (
                  <div
                    key={mod.id}
                    style={{
                      border: isModuleEnabled ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      backgroundColor: isModuleEnabled ? '#f8fafc' : '#ffffff',
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Left: Module Info & Master Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 300px' }}>
                      <input
                        type="checkbox"
                        id={`master-${mod.id}`}
                        checked={isModuleEnabled}
                        onChange={() => handleModuleMasterToggle(mod.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#2563eb',
                          cursor: 'pointer'
                        }}
                      />
                      <label htmlFor={`master-${mod.id}`} style={{ cursor: 'pointer', margin: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.925rem', color: isModuleEnabled ? '#1e3a8a' : '#334155' }}>
                          {mod.label}
                        </div>
                        <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.1rem' }}>
                          {mod.desc}
                        </div>
                      </label>
                    </div>

                    {/* Right: Individual Action Checkboxes */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      backgroundColor: isModuleEnabled ? '#ffffff' : '#f8fafc',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      {/* View Checkbox */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: modPerm.view ? '#16a34a' : '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={modPerm.view}
                          onChange={() => handlePermissionToggle(mod.id, 'view')}
                          style={{ accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>View</span>
                      </label>

                      {/* Create Checkbox */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: modPerm.create ? '#2563eb' : '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={modPerm.create}
                          onChange={() => handlePermissionToggle(mod.id, 'create')}
                          style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>Create</span>
                      </label>

                      {/* Edit Checkbox */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: modPerm.edit ? '#d97706' : '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={modPerm.edit}
                          onChange={() => handlePermissionToggle(mod.id, 'edit')}
                          style={{ accentColor: '#d97706', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>Edit</span>
                      </label>

                      {/* Delete Checkbox */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 600, color: modPerm.delete ? '#dc2626' : '#64748b' }}>
                        <input
                          type="checkbox"
                          checked={modPerm.delete}
                          onChange={() => handlePermissionToggle(mod.id, 'delete')}
                          style={{ accentColor: '#dc2626', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>Delete</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Bottom Action Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '1rem',
            padding: '1.25rem 1.75rem',
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
          }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.5rem', fontWeight: 600, borderRadius: '8px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.75rem',
                fontWeight: 700,
                borderRadius: '8px'
              }}
            >
              <Save size={18} />
              <span>{saving ? 'Saving Permissions...' : 'Save Staff User & Permissions'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Render Main User Directory Table View
  return (
    <div>
      {/* ── Reset Password Modal ─────────────────────────── */}
      {resetModal.open && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            width: '100%', maxWidth: '420px', padding: '2rem'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={20} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Reset Password</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{resetModal.userName}</p>
                </div>
              </div>
              <button onClick={() => setResetModal({ open: false, userId: null, userName: '' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Error */}
            {resetPwdError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <AlertCircle size={16} /> {resetPwdError}
              </div>
            )}

            {/* New Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                New Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Enter new password"
                  value={resetPwd.newPassword}
                  onChange={e => setResetPwd(p => ({ ...p, newPassword: e.target.value }))}
                  style={{ height: '44px', borderRadius: '8px', paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Confirm Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                placeholder="Confirm new password"
                value={resetPwd.confirmPassword}
                onChange={e => setResetPwd(p => ({ ...p, confirmPassword: e.target.value }))}
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setResetModal({ open: false, userId: null, userName: '' })}
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetPasswordSubmit}
                disabled={resetting}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: 700 }}
              >
                <Lock size={16} />
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {formError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.9rem 1.25rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          color: '#991b1b',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, color: '#dc2626' }} />
          <span>{formError}</span>
        </div>
      )}
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Users & System Access Permissions
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Manage staff accounts and configure user-wise module access permissions
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {canCreateUser && (
            <button className="btn btn-primary" onClick={handleAddNew} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}>
              <Plus size={18} />
              <span>Add New Staff User</span>
            </button>
          )}
        </div>
      </div>

      {/* Data Table Container */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Assigned Role</th>
              <th>Account Status</th>
              <th>Last Login</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCcw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Fetching live users from backend API...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No staff users found in backend directory.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</td>
                  <td>{u.email || '-'}</td>
                  <td>{u.mobile}</td>
                  <td>
                    <span className="badge badge-info" style={{ fontWeight: 600 }}>{u.role}</span>
                  </td>
                  <td><StatusBadge status={u.status} /></td>
                  <td style={{ fontSize: '0.825rem', color: '#64748b', whiteSpace: 'nowrap' }}>{u.lastLogin}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {canEditUser && (
                        <button
                          onClick={() => handleEditUser(u)}
                          title="Edit Permissions & Profile"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid #bfdbfe',
                            backgroundColor: '#eff6ff', color: '#2563eb',
                            fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                      )}

                      {canEditUser && (
                        <button
                          onClick={() => handleDeactivateUser(u.id, u.name, u.status)}
                          title={u.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.65rem', borderRadius: '6px',
                            border: u.status === 'Active' ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                            backgroundColor: u.status === 'Active' ? '#f0fdf4' : '#fff7ed',
                            color: u.status === 'Active' ? '#16a34a' : '#ea580c',
                            fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                          <UserCheck size={13} />
                          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}

                      {canEditUser && (
                        <button
                          onClick={() => handleResetPassword(u.id, u.name)}
                          title="Reset User Password"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc', color: '#475569',
                            fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        >
                          <Lock size={13} /> Reset pwd
                        </button>
                      )}

                      {canDeleteUser && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          title="Delete User Permanently"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid #fecaca',
                            backgroundColor: '#fef2f2', color: '#dc2626',
                            fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
