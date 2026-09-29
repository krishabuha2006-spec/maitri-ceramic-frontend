import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, Scale, Percent, Printer, Plus, Search, Edit3, Trash2, 
  ToggleLeft, ToggleRight, CheckCircle2, AlertCircle, RefreshCw, X, Save, 
  ShieldCheck, ArrowRight, Layers, FileSpreadsheet, Users, Shield, Key, 
  Lock, Eye, EyeOff, CheckSquare, Square, UserCheck, UserX, Sliders
} from 'lucide-react';
import { 
  getUnits, createUnit, updateUnit, deleteUnit, deactivateUnit,
  getTaxPresets, createTaxPreset, updateTaxPreset, deleteTaxPreset, deactivateTaxPreset
} from '../services/masterService';
import { 
  getUsers, createUser, updateUser, deleteUser, deactivateUser, resetUserPassword 
} from '../services/userService';
import { 
  getRoles, createRole, updateRole, deleteRole, getRoleDefaultPermissions, setRoleDefaultPermissions 
} from '../services/roleService';
import { 
  getSystemModules, assignUserPermissions 
} from '../services/permissionService';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { ROLES, isSuperAdminRole } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';

export const Settings = () => {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'company';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '', // 'unit' | 'tax' | 'user' | 'role'
    item: null,
    title: '',
    message: ''
  });

  // Synchronize active tab with URL query parameter
  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
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
      showToast(`Unit ${unit.unitCode} marked as ${newStatus}`);
      loadUnits();
    } catch (err) {
      showToast(err?.message || 'Failed to update unit status', 'error');
    }
  };

  const handleDeleteUnit = (unit) => {
    setConfirmModal({
      isOpen: true,
      type: 'unit',
      item: unit,
      title: 'Delete Measurement Unit',
      message: `Are you sure you want to delete unit "${unit.unitCode}"? This will not affect existing historical quotations.`
    });
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
    isDefault: false,
    description: '',
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

  const handleGstRateChange = (rateVal) => {
    const rate = parseFloat(rateVal) || 0;
    const half = Number((rate / 2).toFixed(2));
    setTaxForm(prev => ({
      ...prev,
      gstPct: rate,
      cgstPct: half,
      sgstPct: half,
      igstPct: rate
    }));
  };

  const handleOpenTaxModal = (preset = null) => {
    setTaxFormError('');
    if (preset) {
      setEditingTaxId(preset.id);
      setTaxForm({
        name: preset.name || '',
        gstPct: preset.gstPct || 18,
        cgstPct: preset.cgstPct || 9,
        sgstPct: preset.sgstPct || 9,
        igstPct: preset.igstPct || 18,
        isDefault: !!preset.isDefault,
        description: preset.description || '',
        status: preset.status || 'Active'
      });
    } else {
      setEditingTaxId(null);
      setTaxForm({
        name: '',
        gstPct: 18,
        cgstPct: 9,
        sgstPct: 9,
        igstPct: 18,
        isDefault: false,
        description: '',
        status: 'Active'
      });
    }
    setTaxModalOpen(true);
  };

  const handleTaxSubmit = async (e) => {
    e.preventDefault();
    setTaxFormError('');
    if (!taxForm.name.trim()) {
      setTaxFormError('Please provide a Tax Preset Name (e.g. GST 18%).');
      return;
    }

    setSavingTax(true);
    try {
      if (editingTaxId) {
        await updateTaxPreset(editingTaxId, taxForm);
        showToast(`Tax Preset "${taxForm.name}" updated successfully.`);
      } else {
        await createTaxPreset(taxForm);
        showToast(`Tax Preset "${taxForm.name}" created successfully.`);
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
      showToast(`Tax Preset ${preset.name} marked as ${newStatus}`);
      loadTaxes();
    } catch (err) {
      showToast(err?.message || 'Failed to update tax preset status', 'error');
    }
  };

  const handleDeleteTax = (preset) => {
    setConfirmModal({
      isOpen: true,
      type: 'tax',
      item: preset,
      title: 'Delete Tax Preset',
      message: `Are you sure you want to delete tax preset "${preset.name}"?`
    });
  };

  // --- USER MANAGEMENT STATE (Backend /api/users) ---
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  
  // User Form Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    roleId: '',
    roleName: 'SALES_EXECUTIVE',
    status: 'Active'
  });

  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);

  const loadUsersData = async () => {
    setLoadingUsers(true);
    try {
      const res = await getUsers();
      setUsersList(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenUserModal = (user = null) => {
    setUserFormError('');
    setShowPassword(false);
    if (user) {
      setEditingUserId(user.id);
      const matchedRole = rolesList.find(r => 
        (r._id && (r._id === user.roleId || r.id === user.roleId)) ||
        r.roleName === user.role
      );
      setUserForm({
        name: user.name || '',
        mobile: user.mobile && user.mobile !== '-' ? user.mobile : '',
        email: user.email || '',
        password: '',
        roleId: matchedRole?._id || matchedRole?.id || user.roleId || '',
        roleName: matchedRole?.roleName || user.role || 'SALES_EXECUTIVE',
        status: user.status || 'Active'
      });
    } else {
      setEditingUserId(null);
      const defaultRole = rolesList.find(r => r.roleName === 'SALES_EXECUTIVE') || rolesList[0];
      setUserForm({
        name: '',
        mobile: '',
        email: '',
        password: '',
        roleId: defaultRole?._id || defaultRole?.id || '',
        roleName: defaultRole?.roleName || 'SALES_EXECUTIVE',
        status: 'Active'
      });
    }
    setUserModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setUserFormError('');
    if (!userForm.name.trim()) {
      setUserFormError('Full Name is required.');
      return;
    }
    if (!userForm.mobile.trim() || !/^\d{10}$/.test(userForm.mobile.trim())) {
      setUserFormError('A valid 10-digit mobile number is required.');
      return;
    }
    if (!editingUserId && (!userForm.password || userForm.password.length < 6)) {
      setUserFormError('Password must be at least 6 characters long.');
      return;
    }

    setSavingUser(true);
    try {
      // Find the exact MongoDB Role Object
      const matchedRole = rolesList.find(r => 
        (r._id && (r._id === userForm.roleId || r.id === userForm.roleId)) ||
        r.roleName === userForm.roleName ||
        r.roleName === userForm.roleId
      );
      const roleIdToSend = matchedRole?._id || matchedRole?.id || userForm.roleId;

      const payload = {
        name: userForm.name.trim(),
        mobile: userForm.mobile.trim(),
        email: userForm.email.trim() || undefined,
        roleId: roleIdToSend || undefined,
        role: matchedRole?.roleName || userForm.roleName,
        status: userForm.status,
        isActive: userForm.status === 'Active'
      };

      if (!editingUserId) {
        payload.password = userForm.password;
        await createUser(payload);
        showToast(`User "${userForm.name}" created with role "${payload.role}" successfully.`);
      } else {
        await updateUser(editingUserId, payload);
        showToast(`User "${userForm.name}" updated with role "${payload.role}" successfully.`);
      }
      setUserModalOpen(false);
      loadUsersData();
    } catch (err) {
      setUserFormError(err?.message || 'Failed to save user details.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleUserStatus = async (u) => {
    const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await deactivateUser(u.id, newStatus);
      showToast(`User ${u.name} status updated to ${newStatus}`);
      loadUsersData();
    } catch (err) {
      showToast(err?.message || 'Failed to update user status', 'error');
    }
  };

  const handleDeleteUser = (u) => {
    setConfirmModal({
      isOpen: true,
      type: 'user',
      item: u,
      title: 'Delete Staff User',
      message: `Are you sure you want to permanently delete user account "${u.name}" (${u.mobile})? All active login sessions will be immediately terminated.`
    });
  };

  const handleOpenResetPasswordModal = (u) => {
    setResetUser(u);
    setResetPasswordVal('');
    setResetPasswordError('');
    setShowResetPwd(false);
    setResetModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      setResetPasswordError('Password must be at least 6 characters.');
      return;
    }
    setResettingPassword(true);
    setResetPasswordError('');
    try {
      await resetUserPassword(resetUser.id, { newPassword: resetPasswordVal });
      showToast(`Password for ${resetUser.name} reset successfully.`);
      setResetModalOpen(false);
    } catch (err) {
      setResetPasswordError(err?.message || 'Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  // --- ROLES & PERMISSIONS STATE (Backend /api/roles & /api/permissions) ---
  const [rolesList, setRolesList] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [systemModules, setSystemModules] = useState([]);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState(null);
  const [rolePermissionsMatrix, setRolePermissionsMatrix] = useState({});
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [savingRolePerms, setSavingRolePerms] = useState(false);

  // Role Form Modal State
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [roleFormError, setRoleFormError] = useState('');
  const [roleForm, setRoleForm] = useState({
    roleName: '',
    description: '',
    isActive: true
  });

  const loadRolesAndModules = async () => {
    setLoadingRoles(true);
    try {
      const [rolesData, modulesData] = await Promise.all([
        getRoles(),
        getSystemModules()
      ]);
      const safeRoles = Array.isArray(rolesData) && rolesData.length > 0 ? rolesData : [
        { _id: 'SUPER_ADMIN', roleName: 'SUPER_ADMIN', description: 'Full system unrestricted access', isSystemRole: true, isActive: true },
        { _id: 'ADMIN', roleName: 'ADMIN', description: 'Administrative manager with approval controls', isSystemRole: true, isActive: true },
        { _id: 'SALES_EXECUTIVE', roleName: 'SALES_EXECUTIVE', description: 'Sales, quotations and follow-up entries', isSystemRole: true, isActive: true },
        { _id: 'ACCOUNTANT', roleName: 'ACCOUNTANT', description: 'Billing, invoices and payment receipts', isSystemRole: true, isActive: true },
        { _id: 'DISPATCH_MANAGER', roleName: 'DISPATCH_MANAGER', description: 'Challan generation and stock dispatch', isSystemRole: true, isActive: true }
      ];
      setRolesList(safeRoles);
      
      const safeModules = Array.isArray(modulesData) && modulesData.length > 0 ? modulesData : [
        { moduleKey: 'USER_MANAGEMENT', moduleName: 'User & Permission Management', parentModule: 'SETTINGS' },
        { moduleKey: 'COMPANY_SETTINGS', moduleName: 'Company Settings', parentModule: 'SETTINGS' },
        { moduleKey: 'PRODUCT_MASTER', moduleName: 'Product Master Catalog', parentModule: 'MASTERS' },
        { moduleKey: 'COMPANY_MASTER', moduleName: 'Company Master', parentModule: 'MASTERS' },
        { moduleKey: 'VENDOR_MASTER', moduleName: 'Vendor Master', parentModule: 'MASTERS' },
        { moduleKey: 'UNIT_MASTER', moduleName: 'Unit Master', parentModule: 'MASTERS' },
        { moduleKey: 'TAX_MASTER', moduleName: 'Tax Master', parentModule: 'MASTERS' },
        { moduleKey: 'CUSTOMER', moduleName: 'Customer Management', parentModule: 'SALES' },
        { moduleKey: 'QUOTATION', moduleName: 'Quotation Management', parentModule: 'SALES' },
        { moduleKey: 'FOLLOW_UP', moduleName: 'Follow-Up Management', parentModule: 'SALES' },
        { moduleKey: 'STOCK', moduleName: 'Stock & Inventory', parentModule: 'INVENTORY' },
        { moduleKey: 'CHALLAN', moduleName: 'Delivery Challans', parentModule: 'INVENTORY' },
        { moduleKey: 'INVOICE', moduleName: 'Sales Invoices', parentModule: 'BILLING' },
        { moduleKey: 'PAYMENT', moduleName: 'Payment Entries & Receipts', parentModule: 'BILLING' },
        { moduleKey: 'RETURN_NOTE', moduleName: 'Sales Return Notes', parentModule: 'BILLING' },
        { moduleKey: 'REPORTS', moduleName: 'Reports & Analytics', parentModule: 'REPORTS' }
      ];
      setSystemModules(safeModules);

      if (safeRoles.length > 0) {
        handleSelectRoleForPermissions(safeRoles[0], safeModules);
      }
    } catch (err) {
      console.error('Failed to load roles/modules:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleSelectRoleForPermissions = async (role, modulesOverride = null) => {
    setSelectedRoleForPerms(role);
    setLoadingRolePerms(true);
    const activeMods = modulesOverride || systemModules;
    try {
      const roleId = role._id || role.id;
      const defaultPerms = await getRoleDefaultPermissions(roleId);
      
      const matrix = {};
      // Initialize all modules with default false
      activeMods.forEach(m => {
        matrix[m.moduleKey] = {
          view: false,
          create: false,
          edit: false,
          delete: false,
          export: false,
          approve: false
        };
      });

      // Overlay fetched default permissions from backend
      if (Array.isArray(defaultPerms) && defaultPerms.length > 0) {
        defaultPerms.forEach(dp => {
          const mKey = dp.module?.moduleKey || dp.moduleKey;
          if (mKey && dp.actions) {
            matrix[mKey] = {
              view: Boolean(dp.actions.view),
              create: Boolean(dp.actions.create),
              edit: Boolean(dp.actions.edit),
              delete: Boolean(dp.actions.delete),
              export: Boolean(dp.actions.export),
              approve: Boolean(dp.actions.approve)
            };
          }
        });
      }

      // If Super Admin role, auto-check everything
      if (isSuperAdminRole(role.roleName)) {
        activeMods.forEach(m => {
          matrix[m.moduleKey] = { view: true, create: true, edit: true, delete: true, export: true, approve: true };
        });
      }

      setRolePermissionsMatrix(matrix);
    } catch (err) {
      console.error('Failed to load role permissions:', err);
    } finally {
      setLoadingRolePerms(false);
    }
  };

  const handleTogglePermissionAction = (moduleKey, action) => {
    if (selectedRoleForPerms && isSuperAdminRole(selectedRoleForPerms.roleName)) {
      showToast('Super Admin permissions cannot be restricted.', 'error');
      return;
    }
    setRolePermissionsMatrix(prev => {
      const currentMod = prev[moduleKey] || { view: false, create: false, edit: false, delete: false, export: false, approve: false };
      return {
        ...prev,
        [moduleKey]: {
          ...currentMod,
          [action]: !currentMod[action]
        }
      };
    });
  };

  const handleSetRowPermissions = (moduleKey, allChecked) => {
    if (selectedRoleForPerms && isSuperAdminRole(selectedRoleForPerms.roleName)) return;
    setRolePermissionsMatrix(prev => ({
      ...prev,
      [moduleKey]: {
        view: allChecked,
        create: allChecked,
        edit: allChecked,
        delete: allChecked,
        export: allChecked,
        approve: allChecked
      }
    }));
  };

  const handleGrantAllPermissions = () => {
    if (selectedRoleForPerms && isSuperAdminRole(selectedRoleForPerms.roleName)) return;
    const newMatrix = {};
    systemModules.forEach(m => {
      newMatrix[m.moduleKey] = { view: true, create: true, edit: true, delete: true, export: true, approve: true };
    });
    setRolePermissionsMatrix(newMatrix);
  };

  const handleClearAllPermissions = () => {
    if (selectedRoleForPerms && isSuperAdminRole(selectedRoleForPerms.roleName)) return;
    const newMatrix = {};
    systemModules.forEach(m => {
      newMatrix[m.moduleKey] = { view: false, create: false, edit: false, delete: false, export: false, approve: false };
    });
    setRolePermissionsMatrix(newMatrix);
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleForPerms) return;
    const roleId = selectedRoleForPerms._id || selectedRoleForPerms.id;
    setSavingRolePerms(true);
    try {
      const permissionsArray = Object.entries(rolePermissionsMatrix).map(([moduleKey, actions]) => ({
        moduleKey,
        actions
      }));

      await setRoleDefaultPermissions(roleId, permissionsArray);
      showToast(`Default permissions template for role "${selectedRoleForPerms.roleName}" saved successfully!`);
    } catch (err) {
      showToast(err?.message || 'Failed to save role permissions.', 'error');
    } finally {
      setSavingRolePerms(false);
    }
  };

  const handleOpenRoleModal = (role = null) => {
    setRoleFormError('');
    if (role) {
      setEditingRoleId(role._id || role.id);
      setRoleForm({
        roleName: role.roleName || '',
        description: role.description || '',
        isActive: role.isActive !== false
      });
    } else {
      setEditingRoleId(null);
      setRoleForm({
        roleName: '',
        description: '',
        isActive: true
      });
    }
    setRoleModalOpen(true);
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setRoleFormError('');
    if (!roleForm.roleName.trim()) {
      setRoleFormError('Role Name is required.');
      return;
    }

    setSavingRole(true);
    try {
      if (editingRoleId) {
        await updateRole(editingRoleId, roleForm);
        showToast(`Role "${roleForm.roleName}" updated successfully.`);
      } else {
        const created = await createRole(roleForm);
        showToast(`Role "${roleForm.roleName}" created successfully.`);
        if (created) setSelectedRoleForPerms(created);
      }
      setRoleModalOpen(false);
      loadRolesAndModules();
    } catch (err) {
      setRoleFormError(err?.message || 'Failed to save role.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = (role) => {
    setConfirmModal({
      isOpen: true,
      type: 'role',
      item: role,
      title: 'Delete User Role',
      message: `Are you sure you want to delete role "${role.roleName}"? System roles cannot be deleted.`
    });
  };

  // Master modal delete dispatcher
  const handleConfirmModalDelete = async () => {
    const { type, item } = confirmModal;
    setConfirmModal({ isOpen: false, type: '', item: null, title: '', message: '' });

    if (!item) return;

    try {
      if (type === 'unit') {
        await deleteUnit(item.id);
        showToast(`Unit "${item.unitCode}" deleted successfully.`);
        loadUnits();
      } else if (type === 'tax') {
        await deleteTaxPreset(item.id);
        showToast(`Tax Preset "${item.name}" deleted successfully.`);
        loadTaxes();
      } else if (type === 'user') {
        await deleteUser(item.id);
        showToast(`User "${item.name}" permanently deleted.`);
        loadUsersData();
      } else if (type === 'role') {
        const roleId = item._id || item.id;
        await deleteRole(roleId);
        showToast(`Role "${item.roleName}" deleted successfully.`);
        loadRolesAndModules();
      }
    } catch (err) {
      showToast(err?.message || 'Delete operation failed', 'error');
    }
  };

  useEffect(() => {
    loadUnits();
    loadTaxes();
    loadUsersData();
    loadRolesAndModules();
  }, []);

  // Filtered Lists
  const filteredUnits = units.filter(u => 
    (u.unitCode || '').toLowerCase().includes(unitSearch.toLowerCase()) ||
    (u.unitName || '').toLowerCase().includes(unitSearch.toLowerCase())
  );

  const filteredTaxes = taxes.filter(t => 
    (t.name || '').toLowerCase().includes(taxSearch.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(taxSearch.toLowerCase())
  );

  const filteredUsers = usersList.filter(u => {
    const matchSearch = !userSearch || 
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.mobile || '').includes(userSearch) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = !userRoleFilter || u.role === userRoleFilter;
    const matchStatus = !userStatusFilter || u.status === userStatusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      
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
          backgroundColor: toastType === 'error' ? '#dc2626' : '#16a34a',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
          fontSize: '0.85rem',
          fontWeight: 600,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toastType === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
          System Settings & Master Configuration
        </h1>
        <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
          Manage company profile, measurement units, GST tax presets, staff users, and granular system access permissions.
        </p>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '1.5rem',
        backgroundColor: '#ffffff',
        padding: '0.25rem 0.5rem 0 0.5rem',
        borderRadius: '12px 12px 0 0',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          type="button"
          onClick={() => switchTab('company')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1rem',
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
          onClick={() => switchTab('users')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'users' ? 700 : 500,
            color: activeTab === 'users' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'users' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={16} />
          <span>Users & Staff ({usersList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('permissions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'permissions' ? 700 : 500,
            color: activeTab === 'permissions' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'permissions' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <ShieldCheck size={16} />
          <span>Roles & Permissions ({rolesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('units')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1rem',
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
            padding: '0.65rem 1rem',
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
            padding: '0.65rem 1rem',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
            color: '#64748b',
            whiteSpace: 'nowrap'
          }}
        >
          <Printer size={16} />
          <span>Quotation Formats</span>
          <ArrowRight size={13} style={{ color: '#94a3b8' }} />
        </Link>
      </div>

      {/* TAB 1: COMPANY PROFILE */}
      {activeTab === 'company' && (
        <form onSubmit={handleCompanySave}>
          <div className="card" style={{ marginBottom: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', backgroundColor: '#ffffff' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>
              Company Profile & Print Header Settings
            </h3>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Company Display Name</label>
                <input type="text" name="companyName" className="form-control" value={settings.companyName} onChange={handleCompanyChange} required style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Business Tagline</label>
                <input type="text" name="tagline" className="form-control" value={settings.tagline} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Registered Showroom Address</label>
                <input type="text" name="address" className="form-control" value={settings.address} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Phone Number</label>
                <input type="text" name="phone" className="form-control" value={settings.phone} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Email Address</label>
                <input type="email" name="email" className="form-control" value={settings.email} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>GSTIN Number</label>
                <input type="text" name="gstin" className="form-control" value={settings.gstin} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Default GST %</label>
                <input type="number" name="defaultTaxPct" className="form-control" value={settings.defaultTaxPct} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', backgroundColor: '#ffffff' }}>
            <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#0f172a' }}>
              Bank Account Details (Printed on Invoices & Quotations)
            </h3>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Bank Name</label>
                <input type="text" name="bankName" className="form-control" value={settings.bankName} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Account Number</label>
                <input type="text" name="accountNo" className="form-control" value={settings.accountNo} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>IFSC Code</label>
                <input type="text" name="ifscCode" className="form-control" value={settings.ifscCode} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Branch Name</label>
                <input type="text" name="branch" className="form-control" value={settings.branch} onChange={handleCompanyChange} style={{ height: '38px', borderRadius: '8px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Save size={16} /> Save Company Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: USERS & STAFF MANAGEMENT (API /api/users) */}
      {activeTab === 'users' && (
        <div>
          {/* Action & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 320px', maxWidth: '540px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search staff name, mobile or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.8rem', borderRadius: '8px' }}
                />
              </div>
              <select
                className="form-control"
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                style={{ width: '160px', height: '36px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                <option value="">All Roles</option>
                {rolesList.map(r => (
                  <option key={r._id || r.id} value={r.roleName}>{r.roleName}</option>
                ))}
              </select>
              <select
                className="form-control"
                value={userStatusFilter}
                onChange={e => setUserStatusFilter(e.target.value)}
                style={{ width: '120px', height: '36px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenUserModal()}
              style={{ height: '36px', padding: '0 1rem', fontSize: '0.825rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '8px' }}
            >
              <Plus size={15} /> Add Staff User
            </button>
          </div>

          {/* Users Table */}
          <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflowX: 'auto', backgroundColor: '#ffffff', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Staff Name</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Mobile Number</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Assigned Role</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Last Login</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>
                      <RefreshCw size={20} className="spin" style={{ color: '#2563eb', marginBottom: '0.4rem' }} />
                      <div style={{ fontSize: '0.825rem', color: '#64748b' }}>Fetching live users from server...</div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No staff users found matching criteria.</td></tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{u.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#334155', fontSize: '0.825rem' }}>
                        {u.mobile}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {u.email || '-'}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          backgroundColor: isSuperAdminRole(u.role) ? '#fef3c7' : '#f1f5f9',
                          color: isSuperAdminRole(u.role) ? '#b45309' : '#334155',
                          border: isSuperAdminRole(u.role) ? '1px solid #fde68a' : '1px solid #e2e8f0',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          fontWeight: 700
                        }}>
                          {isSuperAdminRole(u.role) && <ShieldCheck size={12} color="#b45309" />}
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <StatusBadge status={u.status || 'Active'} />
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.75rem' }}>
                        {u.lastLogin || 'Never'}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            className="btn btn-secondary"
                            title={`Toggle Status (${u.status})`}
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            {u.status === 'Active' ? <ToggleRight size={16} color="#16a34a" /> : <ToggleLeft size={16} color="#94a3b8" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenResetPasswordModal(u)}
                            className="btn btn-secondary"
                            title="Reset Password"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', color: '#0284c7' }}
                          >
                            <Key size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenUserModal(u)}
                            className="btn btn-secondary"
                            title="Edit User"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          {!isSuperAdminRole(u.role) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="btn btn-secondary"
                              title="Delete User"
                              style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', color: '#dc2626' }}
                            >
                              <Trash2 size={13} />
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
      )}

      {/* TAB 3: ROLES & SYSTEM ACCESS PERMISSIONS (API /api/roles & /api/permissions) */}
      {activeTab === 'permissions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Left Column: Roles Template List */}
          <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Shield size={16} color="#2563eb" /> System Roles
              </h3>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenRoleModal()}
                style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.75rem', borderRadius: '6px' }}
              >
                <Plus size={13} /> Add Role
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Select a role template to view or customize its default module permissions:
            </p>

            {loadingRoles ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                <RefreshCw size={18} className="spin" style={{ color: '#2563eb' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {rolesList.map(r => {
                  const roleId = r._id || r.id;
                  const isSelected = selectedRoleForPerms && (selectedRoleForPerms._id === roleId || selectedRoleForPerms.id === roleId || selectedRoleForPerms.roleName === r.roleName);
                  const isSys = !!r.isSystemRole || isSuperAdminRole(r.roleName);

                  return (
                    <div
                      key={roleId}
                      onClick={() => handleSelectRoleForPermissions(r)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.825rem', color: isSelected ? '#1d4ed8' : '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>{r.roleName}</span>
                          {isSys && (
                            <span style={{ fontSize: '0.625rem', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                              SYSTEM
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <div style={{ fontSize: '0.725rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                            {r.description}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRoleModal(r);
                          }}
                          className="btn btn-secondary"
                          title="Edit Role Details"
                          style={{ height: '26px', width: '26px', padding: 0, borderRadius: '5px' }}
                        >
                          <Edit3 size={12} />
                        </button>
                        {!isSuperAdminRole(r.roleName) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(r);
                            }}
                            className="btn btn-secondary"
                            title="Delete Role"
                            style={{ height: '26px', width: '26px', padding: 0, borderRadius: '5px', color: '#dc2626' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Interactive Permission Matrix */}
          <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem', backgroundColor: '#ffffff' }}>
            
            {/* Permission Matrix Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Permissions Matrix for:</span>
                  <span style={{ color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem' }}>
                    {selectedRoleForPerms?.roleName || 'Select Role'}
                  </span>
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  Controls default access permissions granted automatically to users assigned this role template.
                </p>
              </div>

              {/* Quick Actions */}
              {!isSuperAdminRole(selectedRoleForPerms?.roleName) && (
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleGrantAllPermissions}
                    className="btn btn-secondary"
                    style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.65rem', borderRadius: '6px' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllPermissions}
                    className="btn btn-secondary"
                    style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.65rem', borderRadius: '6px' }}
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRolePermissions}
                    disabled={savingRolePerms}
                    className="btn btn-primary"
                    style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.85rem', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Save size={13} /> {savingRolePerms ? 'Saving...' : 'Save Permissions'}
                  </button>
                </div>
              )}
            </div>

            {/* Permission Table */}
            {loadingRolePerms ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <RefreshCw size={22} className="spin" style={{ color: '#2563eb', marginBottom: '0.5rem' }} />
                <div>Loading role permissions template...</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>System Module</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '75px' }}>View</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '75px' }}>Create</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '75px' }}>Edit</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '75px' }}>Delete</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '75px' }}>Export</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '75px' }}>Approve</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569', width: '80px' }}>Row All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemModules.map(mod => {
                      const modPerm = rolePermissionsMatrix[mod.moduleKey] || {
                        view: false, create: false, edit: false, delete: false, export: false, approve: false
                      };
                      const allRowChecked = modPerm.view && modPerm.create && modPerm.edit && modPerm.delete && modPerm.export && modPerm.approve;
                      const isSuper = isSuperAdminRole(selectedRoleForPerms?.roleName);

                      return (
                        <tr key={mod.moduleKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.8rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{mod.moduleName}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{mod.moduleKey}</div>
                          </td>
                          
                          {['view', 'create', 'edit', 'delete', 'export', 'approve'].map(act => (
                            <td key={act} style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleTogglePermissionAction(mod.moduleKey, act)}
                                disabled={isSuper}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: isSuper ? 'default' : 'pointer',
                                  color: modPerm[act] ? '#16a34a' : '#cbd5e1'
                                }}
                              >
                                {modPerm[act] ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                            </td>
                          ))}

                          <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleSetRowPermissions(mod.moduleKey, !allRowChecked)}
                              disabled={isSuper}
                              style={{
                                border: 'none',
                                background: 'none',
                                cursor: isSuper ? 'default' : 'pointer',
                                fontSize: '0.7rem',
                                color: allRowChecked ? '#2563eb' : '#94a3b8',
                                fontWeight: 700
                              }}
                            >
                              {allRowChecked ? 'All ON' : 'Toggle'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: UNIT MASTER (MODULE 2) */}
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
          <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflowX: 'auto', backgroundColor: '#ffffff', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
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

      {/* TAB 5: TAX MASTER (MODULE 2) */}
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
          <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflowX: 'auto', backgroundColor: '#ffffff', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse' }}>
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
                  filteredTaxes.map(preset => (
                    <tr key={preset.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{preset.name}</span>
                          {preset.isDefault && (
                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                        {preset.gstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
                        {preset.cgstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
                        {preset.sgstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
                        {preset.igstPct}%
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {preset.description || '-'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <StatusBadge status={preset.status || 'Active'} />
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleTaxStatus(preset)}
                            className="btn btn-secondary"
                            title={`Toggle Status (${preset.status})`}
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            {preset.status === 'Active' ? <ToggleRight size={16} color="#16a34a" /> : <ToggleLeft size={16} color="#94a3b8" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTaxModal(preset)}
                            className="btn btn-secondary"
                            title="Edit Tax Preset"
                            style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTax(preset)}
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

      {/* MODAL: ADD / EDIT STAFF USER */}
      {userModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Users size={18} color="#2563eb" />
                <span>{editingUserId ? 'Edit Staff User Details' : 'Add New Staff User'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} style={{ padding: '1.5rem' }}>
              {userFormError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <AlertCircle size={15} />
                  <span>{userFormError}</span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Full Staff Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rahul Sharma"
                  value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  required
                  style={{ height: '38px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Mobile Number <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="9825000000"
                    value={userForm.mobile}
                    onChange={e => setUserForm({ ...userForm, mobile: e.target.value })}
                    required
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="staff@maitri.com"
                    value={userForm.email}
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {!editingUserId && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Login Password <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Minimum 6 characters"
                      value={userForm.password}
                      onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                      required={!editingUserId}
                      style={{ height: '38px', borderRadius: '8px', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Assigned Role (Live Backend Roles) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={userForm.roleId || userForm.roleName}
                    onChange={e => {
                      const selVal = e.target.value;
                      const matched = rolesList.find(r => (r._id || r.id) === selVal || r.roleName === selVal);
                      setUserForm({
                        ...userForm,
                        roleId: matched?._id || matched?.id || selVal,
                        roleName: matched?.roleName || selVal
                      });
                    }}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.825rem', fontWeight: 600, color: '#0f172a' }}
                  >
                    {rolesList.map(r => (
                      <option key={r._id || r.id} value={r._id || r.id}>
                        {r.roleName} {r.isSystemRole ? '(System)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Account Status
                  </label>
                  <select
                    className="form-control"
                    value={userForm.status}
                    onChange={e => setUserForm({ ...userForm, status: e.target.value })}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setUserModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingUser}
                  style={{ padding: '0.45rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  {savingUser ? 'Saving...' : (editingUserId ? 'Update User & Role' : 'Create User & Assign Role')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET USER PASSWORD */}
      {resetModalOpen && resetUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Key size={16} color="#0284c7" />
                <span>Reset Password for {resetUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} style={{ padding: '1.5rem' }}>
              {resetPasswordError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <AlertCircle size={15} />
                  <span>{resetPasswordError}</span>
                </div>
              )}

              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                Enter a new password for <strong>{resetUser.name}</strong> ({resetUser.mobile}). All their current active refresh sessions will be invalidated.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  New Password (min 6 chars) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPwd ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter new strong password"
                    value={resetPasswordVal}
                    onChange={e => setResetPasswordVal(e.target.value)}
                    required
                    style={{ height: '38px', borderRadius: '8px', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPwd(!showResetPwd)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    {showResetPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resettingPassword}
                  style={{ padding: '0.45rem 1.25rem', borderRadius: '8px', fontWeight: 600, backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                >
                  {resettingPassword ? 'Updating...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ROLE */}
      {roleModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Shield size={18} color="#2563eb" />
                <span>{editingRoleId ? 'Edit Role Template' : 'Create New System Role'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} style={{ padding: '1.5rem' }}>
              {roleFormError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <AlertCircle size={15} />
                  <span>{roleFormError}</span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Role Name (e.g. INVENTORY_MANAGER) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. STORE_EXECUTIVE"
                  value={roleForm.roleName}
                  onChange={e => setRoleForm({ ...roleForm, roleName: e.target.value })}
                  required
                  style={{ height: '38px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Role Description
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Describes access levels and responsibility of staff in this role..."
                  value={roleForm.description}
                  onChange={e => setRoleForm({ ...roleForm, description: e.target.value })}
                  style={{ borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="roleActiveCheck"
                  checked={roleForm.isActive}
                  onChange={e => setRoleForm({ ...roleForm, isActive: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="roleActiveCheck" style={{ fontSize: '0.825rem', color: '#334155', cursor: 'pointer' }}>
                  Active Role (Allow assigning to users)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRoleModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingRole}
                  style={{ padding: '0.45rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  {savingRole ? 'Saving...' : (editingRoleId ? 'Update Role' : 'Create Role')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT UNIT */}
      {unitModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {editingUnitId ? 'Edit Measurement Unit' : 'Add Measurement Unit'}
              </h3>
              <button
                type="button"
                onClick={() => setUnitModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUnitSubmit} style={{ padding: '1.5rem' }}>
              {unitFormError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <AlertCircle size={15} />
                  <span>{unitFormError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
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
                  Description / Application Area
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Measurement unit used for wall tiles, sanitary wares..."
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
                  Allow fractional quantities (e.g. 12.50 Sq.Ft)
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

      {/* MODAL: ADD / EDIT TAX PRESET */}
      {taxModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                {editingTaxId ? 'Edit Tax Preset' : 'Add Tax Preset'}
              </h3>
              <button
                type="button"
                onClick={() => setTaxModalOpen(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTaxSubmit} style={{ padding: '1.5rem' }}>
              {taxFormError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <AlertCircle size={15} />
                  <span>{taxFormError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Preset Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. GST 18%, GST 28%"
                    value={taxForm.name}
                    onChange={e => setTaxForm({ ...taxForm, name: e.target.value })}
                    required
                    style={{ height: '38px', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Total GST Rate (%) <span style={{ color: '#dc2626' }}>*</span>
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

      {/* Custom Confirm Modal for Settings */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="Yes, Delete"
        onConfirm={handleConfirmModalDelete}
        onCancel={() => setConfirmModal({ isOpen: false, type: '', item: null, title: '', message: '' })}
        danger={true}
      />
    </div>
  );
};

export default Settings;
