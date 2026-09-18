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

export const isSuperAdminRole = (role) => {
  if (!role) return false;
  if (typeof role === 'object') {
    role = role.roleName || role.name || role.role || '';
  }
  const clean = String(role).trim().toLowerCase().replace(/[\s_-]+/g, '');
  return clean === 'superadmin' || clean === 'admin' || clean === 'owner' || clean === 'master' || role === ROLES.SUPER_ADMIN;
};

export const normalizeRole = (role) => {
  if (!role) return ROLES.SUPER_ADMIN;
  if (typeof role === 'object') {
    role = role.roleName || role.name || role.role || '';
  }
  const clean = String(role).trim().toLowerCase().replace(/[\s_-]+/g, '');
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

  // 1. If rawPermissions exists as an object with key-value pairs
  if (rawPermissions && typeof rawPermissions === 'object' && !Array.isArray(rawPermissions) && Object.keys(rawPermissions).length > 0) {
    let hasAnyExplicitPermission = false;
    MODULE_LIST.forEach(m => {
      const p = rawPermissions[m.id];
      if (p !== undefined && p !== null) {
        if (typeof p === 'boolean') {
          base[m.id] = { view: p, create: p, edit: p, delete: p };
          if (p) hasAnyExplicitPermission = true;
        } else if (typeof p === 'object') {
          base[m.id] = {
            view: !!p.view,
            create: !!p.create,
            edit: !!p.edit,
            delete: !!p.delete
          };
          if (p.view || p.create || p.edit || p.delete) hasAnyExplicitPermission = true;
        }
      }
    });

    if (hasAnyExplicitPermission) {
      return base;
    }
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

  // 3. Fallback to role presets if no custom permissions exist or if raw was all-empty
  if (DEFAULT_ROLE_PERMISSIONS[normRole]) {
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
    const hasAnyActive = Object.values(userPermissions).some(
      p => p && (p === true || p.view || p.create || p.edit || p.delete)
    );
    if (hasAnyActive) {
      if (userPermissions[moduleId] !== undefined) {
        return !!userPermissions[moduleId]?.create;
      }
      if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
        return !!userPermissions['quotations']?.create;
      }
      return false;
    }
  }

  const normRole = normalizeRole(role);
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[normRole];
  return !!(rolePerms && rolePerms[moduleId]?.create);
};

export const canEdit = (role, moduleId, userPermissions = null) => {
  if (isSuperAdminRole(role)) return true;

  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    const hasAnyActive = Object.values(userPermissions).some(
      p => p && (p === true || p.view || p.create || p.edit || p.delete)
    );
    if (hasAnyActive) {
      if (userPermissions[moduleId] !== undefined) {
        return !!userPermissions[moduleId]?.edit;
      }
      if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
        return !!userPermissions['quotations']?.edit;
      }
      return false;
    }
  }

  const normRole = normalizeRole(role);
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[normRole];
  return !!(rolePerms && rolePerms[moduleId]?.edit);
};

export const canDelete = (role, moduleId, userPermissions = null) => {
  if (isSuperAdminRole(role)) return true;

  if (userPermissions && typeof userPermissions === 'object' && Object.keys(userPermissions).length > 0) {
    const hasAnyActive = Object.values(userPermissions).some(
      p => p && (p === true || p.view || p.create || p.edit || p.delete)
    );
    if (hasAnyActive) {
      if (userPermissions[moduleId] !== undefined) {
        return !!userPermissions[moduleId]?.delete;
      }
      if (moduleId === 'follow-ups' && userPermissions['quotations'] !== undefined) {
        return !!userPermissions['quotations']?.delete;
      }
      return false;
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
    const raw = localStorage.getItem('maitri_user');
    if (raw) {
      const u = JSON.parse(raw);
      role = u?.role;
      permissions = u?.permissions;
    }
  } catch (e) {}

  return {
    canView: canView(role, moduleId, permissions),
    canCreate: canCreate(role, moduleId, permissions),
    canEdit: canEdit(role, moduleId, permissions),
    canDelete: canDelete(role, moduleId, permissions),
    isSuperAdmin: isSuperAdminRole(role)
  };
};
