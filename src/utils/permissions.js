// Role-Based Access Control logic & User-wise Permissions for Maitri Ceramic System
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

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
  [ROLES.SALES_EXECUTIVE]: ['dashboard', 'products', 'companies', 'customers', 'quotations', 'reports'],
  [ROLES.SALES_MANAGER]: ['dashboard', 'products', 'product-groups', 'companies', 'quotations', 'customers', 'stock', 'reports'],
  [ROLES.INVENTORY_USER]: ['dashboard', 'products', 'product-groups', 'companies', 'stock', 'challans', 'returns', 'reports'],
  [ROLES.ACCOUNTS_USER]: ['dashboard', 'companies', 'invoices', 'payments', 'reports'],
  [ROLES.CUSTOM]: []
};

/**
 * Normalizes any raw permission format into a standard object.
 * If fallbackToDefaults is false, it returns empty (all false) instead of prefilling.
 */
export const normalizePermissions = (rawPermissions, role = null, fallbackToDefaults = false) => {
  const base = getEmptyPermissions();

  // 1. If rawPermissions exists, USE IT EXACTLY as configured!
  if (rawPermissions && typeof rawPermissions === 'object' && !Array.isArray(rawPermissions) && Object.keys(rawPermissions).length > 0) {
    MODULE_LIST.forEach(m => {
      const p = rawPermissions[m.id];
      if (p !== undefined && p !== null) {
        if (typeof p === 'boolean') {
          base[m.id] = { view: p, create: p, edit: p, delete: p };
        } else if (typeof p === 'object') {
          base[m.id] = {
            view: !!p.view,
            create: !!p.create,
            edit: !!p.edit,
            delete: !!p.delete
          };
        }
      }
    });
    return base;
  }

  // 2. If array format (e.g. ['dashboard', 'products'])
  if (Array.isArray(rawPermissions) && rawPermissions.length > 0) {
    rawPermissions.forEach(item => {
      if (typeof item === 'string') {
        if (item.includes(':')) {
          const [mod, act] = item.split(':');
          if (base[mod]) {
            if (act === 'view' || act === 'read') base[mod].view = true;
            if (act === 'create' || act === 'write' || act === 'add') base[mod].create = true;
            if (act === 'edit' || act === 'update') base[mod].edit = true;
            if (act === 'delete' || act === 'remove') base[mod].delete = true;
          }
        } else if (base[item]) {
          base[item].view = true;
        }
      } else if (item && typeof item === 'object') {
        const modKey = item.moduleId || item.module || item.name || item.id;
        if (modKey && base[modKey]) {
          const acts = item.actions || [];
          base[modKey] = {
            view: item.view !== undefined ? !!item.view : (acts.includes('view') || acts.includes('read') || true),
            create: item.create !== undefined ? !!item.create : (acts.includes('create') || acts.includes('write')),
            edit: item.edit !== undefined ? !!item.edit : (acts.includes('edit') || acts.includes('update')),
            delete: item.delete !== undefined ? !!item.delete : acts.includes('delete')
          };
        }
      }
    });
    return base;
  }

  // 3. ONLY if rawPermissions is not present AND fallbackToDefaults is explicitly true
  if (fallbackToDefaults && role) {
    if (role === ROLES.SUPER_ADMIN) {
      const full = {};
      MODULE_LIST.forEach(m => {
        full[m.id] = { view: true, create: true, edit: true, delete: true };
      });
      return full;
    }
    if (DEFAULT_ROLE_PERMISSIONS[role]) {
      return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role]));
    }
  }

  return base;
};

/**
 * STRICT Menu permission check:
 * If userPermissions is provided, it is the ABSOLUTE and ONLY source of truth.
 * Only checked modules return true. Everything else is false.
 */
export const hasMenuPermission = (role, menuId, userPermissions = null) => {
  // 1. If userPermissions is provided, it is the ABSOLUTE and ONLY source of truth
  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[menuId] !== undefined) {
      return !!userPermissions[menuId]?.view;
    }
    // Only 'follow-ups' maps to quotations if not defined separately
    if (menuId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.view;
    }
    // Any module not explicitly checked is strictly denied
    return false;
  }

  // 2. Only if no custom userPermissions are defined, fallback to role check
  if (role === ROLES.SUPER_ADMIN) return true;

  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role];
  if (roleDefaults && roleDefaults[menuId] !== undefined) {
    return !!roleDefaults[menuId]?.view;
  }

  return false;
};

export const canView = (role, moduleId, userPermissions = null) => {
  return hasMenuPermission(role, moduleId, userPermissions);
};

export const canCreate = (role, moduleId, userPermissions = null) => {
  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[moduleId] !== undefined) {
      return !!userPermissions[moduleId]?.create;
    }
    if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.create;
    }
    return false;
  }
  if (role === ROLES.SUPER_ADMIN) return true;
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[role];
  return !!(rolePerms && rolePerms[moduleId]?.create);
};

export const canEdit = (role, moduleId, userPermissions = null) => {
  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[moduleId] !== undefined) {
      return !!userPermissions[moduleId]?.edit;
    }
    if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.edit;
    }
    return false;
  }
  if (role === ROLES.SUPER_ADMIN) return true;
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[role];
  return !!(rolePerms && rolePerms[moduleId]?.edit);
};

export const canDelete = (role, moduleId, userPermissions = null) => {
  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    if (userPermissions[moduleId] !== undefined) {
      return !!userPermissions[moduleId]?.delete;
    }
    if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
      return !!userPermissions['quotations']?.delete;
    }
    return false;
  }
  if (role === ROLES.SUPER_ADMIN) return true;
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[role];
  return !!(rolePerms && rolePerms[moduleId]?.delete);
};

export const usePermissions = (moduleId) => {
  const context = useContext(AuthContext);
  const currentUser = context?.currentUser;
  const role = currentUser?.role;
  const permissions = currentUser?.permissions;

  return {
    canView: canView(role, moduleId, permissions),
    canCreate: canCreate(role, moduleId, permissions),
    canEdit: canEdit(role, moduleId, permissions),
    canDelete: canDelete(role, moduleId, permissions),
    isSuperAdmin: role === ROLES.SUPER_ADMIN
  };
};
