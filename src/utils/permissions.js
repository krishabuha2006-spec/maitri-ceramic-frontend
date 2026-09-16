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

// Default permission presets per role
export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    products: { view: true, create: true, edit: true, delete: true },
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
    companies: { view: true, create: false, edit: false, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    quotations: { view: true, create: false, edit: false, delete: false },
    stock: { view: true, create: false, edit: false, delete: false },
    challans: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false },
    payments: { view: true, create: true, edit: true, delete: false },
    returns: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, create: true, edit: true, delete: false },
    users: { view: false, create: false, edit: false, delete: false }
  }
};

// Legacy backward-compatibility check
export const MENU_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: MODULE_LIST.map(m => m.id),
  [ROLES.SALES_EXECUTIVE]: ['dashboard', 'products', 'companies', 'customers', 'quotations', 'reports'],
  [ROLES.SALES_MANAGER]: ['dashboard', 'products', 'companies', 'quotations', 'customers', 'stock', 'reports'],
  [ROLES.INVENTORY_USER]: ['dashboard', 'products', 'companies', 'stock', 'challans', 'returns', 'reports'],
  [ROLES.ACCOUNTS_USER]: ['dashboard', 'companies', 'invoices', 'payments', 'reports']
};

export const hasMenuPermission = (role, menuId, userPermissions = null) => {
  if (!role || role === ROLES.SUPER_ADMIN) return true;
  if (userPermissions && userPermissions[menuId]) {
    return !!userPermissions[menuId].view;
  }
  const allowedMenus = MENU_PERMISSIONS[role] || [];
  return allowedMenus.includes(menuId);
};

