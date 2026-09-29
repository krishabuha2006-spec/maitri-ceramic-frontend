import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Role-Based Access Control logic & User-wise Permissions for Maitri Ceramic System

export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  SALES_MANAGER: 'Sales Manager',
  SALES_EXECUTIVE: 'Sales Executive',
  INVENTORY_USER: 'Inventory User',
  ACCOUNTS_USER: 'Accounts User',
  CUSTOM: 'Custom Permissions'
};

export const MODULE_LIST = [
  { id: 'dashboard', label: 'Dashboard & Overview', desc: 'Summary metrics, sales stats & recent activity feed' },
  { id: 'products', label: 'Products & Price Catalog', desc: 'Tile catalog, box coverage rates & pricing details' },
  { id: 'product-groups', label: 'Product Group Master', desc: 'Hierarchical Product Categories & Material Group Classifications' },
  { id: 'companies', label: 'Companies & Brands', desc: 'Brand suppliers, manufacturers & primary firm settings' },
  { id: 'vendors', label: 'Vendors & Suppliers', desc: 'Tile suppliers, manufacturers & vendor procurement contacts' },
  { id: 'customers', label: 'Customer Accounts & Ledger', desc: 'Customer contacts, GST details & outstanding balances' },
  { id: 'quotations', label: 'Quotations & Proforma', desc: 'Sales quotes, price estimates & proforma invoices' },
  { id: 'stock', label: 'Stock & Warehousing', desc: 'Inventory stock levels, batch updates & stock entries' },
  { id: 'challans', label: 'Delivery Challans', desc: 'Dispatch vouchers, truck details & delivery status' },
  { id: 'invoices', label: 'Tax Invoices & GST Billing', desc: 'Sales billing, GST calculations & invoice printouts' },
  { id: 'payments', label: 'Payment Receipts', desc: 'Money receipts, bank postings & outstanding updates' },
  { id: 'returns', label: 'Sales Returns & Credit Notes', desc: 'Returned ceramic goods & credit note generation' },
  { id: 'reports', label: 'Reports & Business Analytics', desc: 'Sales summaries, stock reports & ledger exports' },
  { id: 'users', label: 'Users & System Access', desc: 'Staff account management & permission settings' }
];

/**
 * Returns completely clean, empty permissions (all false)
 * Used so the form does NOT prefill any permissions automatically.
 */
export const getEmptyPermissions = () => {
  const empty = {};
  MODULE_LIST.forEach(mod => {
    empty[mod.id] = { view: false, create: false, edit: false, delete: false };
  });
  return empty;
};

// Default permission presets per role (used ONLY if user has no assigned permissions)
export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    products: { view: true, create: true, edit: true, delete: true },
    'product-groups': { view: true, create: true, edit: true, delete: true },
    companies: { view: true, create: true, edit: true, delete: true },
    vendors: { view: true, create: true, edit: true, delete: true },
    customers: { view: true, create: true, edit: true, delete: true },
    quotations: { view: true, create: true, edit: true, delete: true },
    stock: { view: true, create: true, edit: true, delete: true },
    challans: { view: true, create: true, edit: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true },
    payments: { view: true, create: true, edit: true, delete: true },
    returns: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true }
  },
  [ROLES.SALES_EXECUTIVE]: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    'product-groups': { view: false, create: false, edit: false, delete: false },
    companies: { view: true, create: false, edit: false, delete: false },
    vendors: { view: true, create: false, edit: false, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    quotations: { view: true, create: true, edit: true, delete: false },
    stock: { view: true, create: false, edit: false, delete: false },
    challans: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, delete: false },
    returns: { view: false, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false }
  },
  [ROLES.SALES_MANAGER]: {
    dashboard: { view: true, create: true, edit: true, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    'product-groups': { view: true, create: false, edit: false, delete: false },
    companies: { view: true, create: true, edit: true, delete: false },
    vendors: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    quotations: { view: true, create: true, edit: true, delete: true },
    stock: { view: true, create: false, edit: false, delete: false },
    challans: { view: true, create: true, edit: false, delete: false },
    invoices: { view: true, create: true, edit: false, delete: false },
    payments: { view: true, create: true, edit: false, delete: false },
    returns: { view: true, create: true, edit: false, delete: false },
    reports: { view: true, create: true, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false }
  },
  [ROLES.INVENTORY_USER]: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    products: { view: true, create: true, edit: true, delete: false },
    'product-groups': { view: true, create: true, edit: true, delete: false },
    companies: { view: true, create: true, edit: true, delete: false },
    vendors: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: false, edit: false, delete: false },
    quotations: { view: false, create: false, edit: false, delete: false },
    stock: { view: true, create: true, edit: true, delete: true },
    challans: { view: true, create: true, edit: true, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, delete: false },
    returns: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false }
  },
  [ROLES.ACCOUNTS_USER]: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    'product-groups': { view: false, create: false, edit: false, delete: false },
    companies: { view: true, create: false, edit: false, delete: false },
    vendors: { view: true, create: false, edit: false, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    quotations: { view: true, create: false, edit: false, delete: false },
    stock: { view: true, create: false, edit: false, delete: false },
    challans: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false },
    payments: { view: true, create: true, edit: true, delete: false },
    returns: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, create: true, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false }
  },
  [ROLES.CUSTOM]: {
    dashboard: { view: false, create: false, edit: false, delete: false },
    products: { view: false, create: false, edit: false, delete: false },
    'product-groups': { view: false, create: false, edit: false, delete: false },
    companies: { view: false, create: false, edit: false, delete: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    customers: { view: false, create: false, edit: false, delete: false },
    quotations: { view: false, create: false, edit: false, delete: false },
    stock: { view: false, create: false, edit: false, delete: false },
    challans: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, delete: false },
    returns: { view: false, create: false, edit: false, delete: false },
    reports: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false }
  }
};

export const MENU_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: MODULE_LIST.map(m => m.id),
  [ROLES.SALES_EXECUTIVE]: ['dashboard', 'products', 'companies', 'vendors', 'customers', 'quotations', 'reports'],
  [ROLES.SALES_MANAGER]: ['dashboard', 'products', 'product-groups', 'companies', 'vendors', 'quotations', 'customers', 'stock', 'reports'],
  [ROLES.INVENTORY_USER]: ['dashboard', 'products', 'product-groups', 'companies', 'vendors', 'stock', 'challans', 'returns', 'reports'],
  [ROLES.ACCOUNTS_USER]: ['dashboard', 'companies', 'vendors', 'invoices', 'payments', 'reports'],
  [ROLES.CUSTOM]: []
};

export const isSuperAdminRole = (role) => {
  if (!role) return false;
  if (typeof role === 'object') {
    role = role.roleName || role.name || role.role || '';
  }
  const clean = String(role).trim().toLowerCase().replace(/[\s_-]+/g, '');
  return clean === 'superadmin' || clean === 'admin' || clean === 'owner' || clean === 'master' || role === ROLES.SUPER_ADMIN;
};

export const formatRoleName = (role) => {
  if (!role) return '';
  if (typeof role === 'object') {
    role = role.displayName || role.roleName || role.name || role.role || '';
  }
  if (!role) return '';
  const str = String(role).trim();
  const clean = str.toLowerCase().replace(/[\s_-]+/g, '');
  if (clean === 'superadmin' || clean === 'admin' || clean === 'owner' || clean === 'master') return 'Super Admin';
  if (clean === 'salesmanager') return 'Sales Manager';
  if (clean === 'salesexecutive' || clean === 'sales') return 'Sales Executive';
  if (clean === 'inventoryuser' || clean === 'inventory') return 'Inventory User';
  if (clean === 'accountsuser' || clean === 'accounts' || clean === 'accountant') return 'Accounts User';
  if (clean === 'custom' || clean === 'custompermissions') return 'Custom Permissions';

  if (str.includes('_')) {
    return str.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return str;
};

export const normalizeRole = (role) => {
  if (!role) return '';
  if (typeof role === 'object') {
    role = role.roleName || role.name || role.role || '';
  }
  const clean = String(role).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!clean) return '';
  if (clean === 'superadmin' || clean === 'admin' || clean === 'owner' || clean === 'master' || clean === 'super_admin') {
    return ROLES.SUPER_ADMIN;
  }
  if (clean === 'salesmanager') return ROLES.SALES_MANAGER;
  if (clean === 'salesexecutive' || clean === 'sales') return ROLES.SALES_EXECUTIVE;
  if (clean === 'inventoryuser' || clean === 'inventory') return ROLES.INVENTORY_USER;
  if (clean === 'accountsuser' || clean === 'accounts' || clean === 'accountant') return ROLES.ACCOUNTS_USER;
  if (clean === 'custom' || clean === 'custompermissions') return ROLES.CUSTOM;
  return role;
};

export const BACKEND_TO_FRONTEND_MODULE_MAP = {
  // Settings & Users
  USER_MANAGEMENT: 'users',
  COMPANY_SETTINGS: 'companies',
  AUDIT_LOG: 'reports',

  // Masters
  MASTER_MANAGEMENT: 'dashboard',
  COMPANY_MASTER: 'companies',
  PRODUCT_GROUP_MASTER: 'product-groups',
  PRODUCT_MASTER: 'products',
  VENDOR_MASTER: 'vendors',
  UNIT_MASTER: 'products',
  TAX_MASTER: 'invoices',
  PAYMENT_MODE_MASTER: 'payments',
  QUOTATION_FORMAT_MASTER: 'quotations',
  PRODUCT_IMPORT: 'products',

  // Transactions
  CUSTOMER: 'customers',
  QUOTATION: 'quotations',
  FOLLOW_UP: 'quotations',
  QUOTATION_CONFIRMATION: 'quotations',
  STOCK: 'stock',
  CHALLAN: 'challans',
  INVOICE: 'invoices',
  PAYMENT: 'payments',
  RETURN_NOTE: 'returns',
  CUSTOMER_LEDGER: 'customers',
  PRODUCT_QUOTATION_TRACKING: 'reports',
  PRODUCT_TRACKING: 'reports',
  REPORTS: 'reports',
  DASHBOARD: 'dashboard'
};

export const FRONTEND_TO_BACKEND_MAP = {
  dashboard: ['DASHBOARD', 'MASTER_MANAGEMENT'],
  products: ['PRODUCT_MASTER', 'PRODUCT_IMPORT', 'UNIT_MASTER'],
  'product-groups': ['PRODUCT_GROUP_MASTER'],
  companies: ['COMPANY_MASTER', 'COMPANY_SETTINGS'],
  vendors: ['VENDOR_MASTER'],
  customers: ['CUSTOMER', 'CUSTOMER_LEDGER'],
  quotations: ['QUOTATION', 'FOLLOW_UP', 'QUOTATION_CONFIRMATION', 'QUOTATION_FORMAT_MASTER'],
  stock: ['STOCK'],
  challans: ['CHALLAN'],
  invoices: ['INVOICE', 'TAX_MASTER'],
  payments: ['PAYMENT', 'PAYMENT_MODE_MASTER'],
  returns: ['RETURN_NOTE'],
  reports: ['REPORTS', 'PRODUCT_TRACKING', 'PRODUCT_QUOTATION_TRACKING', 'AUDIT_LOG'],
  users: ['USER_MANAGEMENT']
};

/**
 * Converts frontend module permission object into backend payload array for /permissions/assign
 */
export const convertPermsToBackendArray = (frontendPerms) => {
  if (!frontendPerms || typeof frontendPerms !== 'object') return [];
  const backendList = [];
  const processedKeys = new Set();

  Object.entries(frontendPerms).forEach(([fKey, act]) => {
    if (!act) return;
    const bKeys = FRONTEND_TO_BACKEND_MAP[fKey] || [fKey.toUpperCase()];
    bKeys.forEach(bKey => {
      if (!processedKeys.has(bKey)) {
        processedKeys.add(bKey);
        backendList.push({
          moduleKey: bKey,
          actions: {
            view: Boolean(act.view),
            create: Boolean(act.create),
            edit: Boolean(act.edit),
            delete: Boolean(act.delete),
            export: Boolean(act.export || act.view),
            approve: Boolean(act.approve || act.edit)
          },
          dataScope: 'ALL'
        });
      }
    });
  });

  return backendList;
};

/**
 * Normalizes any raw permission format into a standard object.
 * For Super Admin, always returns 100% full permissions.
 * If fallbackToDefaults is true, or if rawPermissions has no active permissions,
 * it falls back to the default permissions for the user's role.
 */
export const normalizePermissions = (rawPermissions, role = null, fallbackToDefaults = true) => {
  const normRole = normalizeRole(role);

  // Super Admin ALWAYS has full unrestricted access on all modules
  if (isSuperAdminRole(normRole)) {
    const full = {};
    MODULE_LIST.forEach(m => {
      full[m.id] = { view: true, create: true, edit: true, delete: true };
    });
    return full;
  }

  const base = getEmptyPermissions();
  let hasAnyExplicitPermission = false;

  const mapToFrontendKey = (key) => {
    if (!key) return null;
    const str = String(key).trim();
    if (base[str] !== undefined) return str;
    const upper = str.toUpperCase();
    if (BACKEND_TO_FRONTEND_MODULE_MAP[upper]) return BACKEND_TO_FRONTEND_MODULE_MAP[upper];
    const lower = str.toLowerCase();
    if (base[lower] !== undefined) return lower;
    return null;
  };

  // 1. If rawPermissions exists as an object with key-value pairs
  if (rawPermissions && typeof rawPermissions === 'object' && !Array.isArray(rawPermissions) && Object.keys(rawPermissions).length > 0) {
    Object.entries(rawPermissions).forEach(([rawKey, p]) => {
      const fKey = mapToFrontendKey(rawKey);
      if (!fKey || p === undefined || p === null) return;

      if (typeof p === 'boolean') {
        base[fKey] = {
          view: base[fKey].view || p,
          create: base[fKey].create || p,
          edit: base[fKey].edit || p,
          delete: base[fKey].delete || p
        };
        if (p) hasAnyExplicitPermission = true;
      } else if (typeof p === 'object') {
        const v = !!p.view;
        const c = !!p.create;
        const e = !!p.edit;
        const d = !!p.delete;
        base[fKey] = {
          view: base[fKey].view || v,
          create: base[fKey].create || c,
          edit: base[fKey].edit || e,
          delete: base[fKey].delete || d
        };
        if (v || c || e || d) hasAnyExplicitPermission = true;
      }
    });

    if (hasAnyExplicitPermission) {
      return base;
    }
  }

  // 2. If array format (e.g. ['dashboard', 'products'] or backend UserPermission documents)
  if (Array.isArray(rawPermissions) && rawPermissions.length > 0) {
    rawPermissions.forEach(item => {
      if (typeof item === 'string') {
        if (item.includes(':')) {
          const [mod, act] = item.split(':');
          const fKey = mapToFrontendKey(mod);
          if (fKey && base[fKey]) {
            if (act === 'view' || act === 'read') { base[fKey].view = true; hasAnyExplicitPermission = true; }
            if (act === 'create' || act === 'write' || act === 'add') { base[fKey].create = true; hasAnyExplicitPermission = true; }
            if (act === 'edit' || act === 'update') { base[fKey].edit = true; hasAnyExplicitPermission = true; }
            if (act === 'delete' || act === 'remove') { base[fKey].delete = true; hasAnyExplicitPermission = true; }
          }
        } else {
          const fKey = mapToFrontendKey(item);
          if (fKey && base[fKey]) {
            base[fKey].view = true;
            hasAnyExplicitPermission = true;
          }
        }
      } else if (item && typeof item === 'object') {
        const rawMod = item.moduleKey || item.module?.moduleKey || item.moduleName || item.moduleId || item.module || item.name || item.id;
        const fKey = mapToFrontendKey(rawMod);
        if (fKey && base[fKey]) {
          const acts = item.actions || {};
          const isArr = Array.isArray(acts);
          const v = item.view !== undefined ? !!item.view : (isArr ? (acts.includes('view') || acts.includes('read')) : !!acts.view);
          const c = item.create !== undefined ? !!item.create : (isArr ? (acts.includes('create') || acts.includes('write')) : !!acts.create);
          const e = item.edit !== undefined ? !!item.edit : (isArr ? (acts.includes('edit') || acts.includes('update')) : !!acts.edit);
          const d = item.delete !== undefined ? !!item.delete : (isArr ? acts.includes('delete') : !!acts.delete);

          base[fKey] = {
            view: base[fKey].view || v,
            create: base[fKey].create || c,
            edit: base[fKey].edit || e,
            delete: base[fKey].delete || d
          };
          if (v || c || e || d) hasAnyExplicitPermission = true;
        }
      }
    });

    if (hasAnyExplicitPermission) {
      return base;
    }
  }

  // 3. Fallback to role presets if no custom permissions exist or if raw was all-empty
  if (fallbackToDefaults && normRole && DEFAULT_ROLE_PERMISSIONS[normRole]) {
    return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[normRole]));
  }

  return base;
};

/**
 * Menu permission check:
 * - Super Admin always returns true for all menus.
 * - Custom permissions are respected if assigned.
 * - Otherwise falls back to role default permissions.
 */
export const hasMenuPermission = (role, menuId, userPermissions = null) => {
  // 1. Super Admin ALWAYS has full access to every menu
  if (isSuperAdminRole(role)) return true;

  // 2. If userPermissions has active entries, use it
  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    const hasAnyActive = Object.values(userPermissions).some(
      p => p && (p === true || p.view || p.create || p.edit || p.delete)
    );
    if (hasAnyActive) {
      if (userPermissions[menuId] !== undefined) {
        return !!userPermissions[menuId]?.view;
      }
      if (menuId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
        return !!userPermissions['quotations']?.view;
      }
      return false;
    }
  }

  // 3. Fallback to role check
  const normRole = normalizeRole(role);
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[normRole];
  if (roleDefaults && roleDefaults[menuId] !== undefined) {
    return !!roleDefaults[menuId]?.view;
  }

  if (MENU_PERMISSIONS[normRole]?.includes(menuId)) {
    return true;
  }

  return false;
};

export const canView = (role, moduleId, userPermissions = null) => {
  return hasMenuPermission(role, moduleId, userPermissions);
};

export const canCreate = (role, moduleId, userPermissions = null) => {
  if (isSuperAdminRole(role)) return true;

  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[moduleId] !== undefined) {
      return !!userPermissions[moduleId]?.create;
    }
    if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.create;
    }
    if (moduleId === 'product-groups' && userPermissions['products'] !== undefined) {
      return !!userPermissions['product-groups']?.create || !!userPermissions['products']?.create;
    }
  }

  const normRole = normalizeRole(role);
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[normRole];
  return !!(rolePerms && rolePerms[moduleId]?.create);
};

export const canEdit = (role, moduleId, userPermissions = null) => {
  if (isSuperAdminRole(role)) return true;

  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[moduleId] !== undefined) {
      return !!userPermissions[moduleId]?.edit;
    }
    if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.edit;
    }
    if (moduleId === 'product-groups' && userPermissions['products'] !== undefined) {
      return !!userPermissions['product-groups']?.edit || !!userPermissions['products']?.edit;
    }
  }

  const normRole = normalizeRole(role);
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[normRole];
  return !!(rolePerms && rolePerms[moduleId]?.edit);
};

export const canDelete = (role, moduleId, userPermissions = null) => {
  if (isSuperAdminRole(role)) return true;

  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[moduleId] !== undefined) {
      return !!userPermissions[moduleId]?.delete;
    }
    if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.delete;
    }
    if (moduleId === 'product-groups' && userPermissions['products'] !== undefined) {
      return !!userPermissions['product-groups']?.delete || !!userPermissions['products']?.delete;
    }
  }

  const normRole = normalizeRole(role);
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[normRole];
  return !!(rolePerms && rolePerms[moduleId]?.delete);
};

export const usePermissions = (moduleId) => {
  let role = null;
  let permissions = null;
  try {
    const auth = useContext(AuthContext);
    if (auth?.currentUser) {
      role = auth.currentUser.roleKey || auth.currentUser.rawRole || auth.currentUser.role;
      permissions = auth.currentUser.permissions;
    }
  } catch (e) {}

  const isSuper = isSuperAdminRole(role);

  return {
    canView: isSuper || canView(role, moduleId, permissions),
    canCreate: isSuper || canCreate(role, moduleId, permissions),
    canEdit: isSuper || canEdit(role, moduleId, permissions),
    canDelete: isSuper || canDelete(role, moduleId, permissions),
    isSuperAdmin: isSuper
  };
};
