import api, { extractArray } from './api';

let MOCK_CHALLANS = [
  {
    id: 'CH-2026-001',
    challanNumber: 'CH-2026-001',
    date: '2026-03-06',
    customerId: 'CUST-001',
    customerName: 'Rajesh Sharma Construction',
    customerContact: '9825012345',
    customerAddress: 'Site 12, Green Villa Project, SG Highway, Ahmedabad',
    refQuotationNo: 'QT-2026-001',
    refOrderNo: 'ORD-8821',
    salesperson: 'Vikram Mehta',
    driverName: 'Ramesh Patel',
    vehicleNo: 'GJ-01-AB-1234',
    deliveryDetails: 'Dispatched via Eicher 14ft. Handle ceramic tiles with care.',
    status: 'Delivered',
    items: [
      {
        sku: 'VT-60120-GL',
        productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
        description: 'Statuario Marble Finish Heavy Duty',
        quantity: 1150,
        unit: 'Sq.Ft'
      }
    ],
    remarks: 'Partial dispatch delivered at site 12.'
  },
  {
    id: 'CH-2026-002',
    challanNumber: 'CH-2026-002',
    date: '2026-03-07',
    customerId: 'CUST-003',
    customerName: 'Mehta Interior Designers',
    customerContact: '9712944332',
    customerAddress: 'Client Villa, Bopele, Ahmedabad',
    refQuotationNo: 'QT-2026-002',
    refOrderNo: 'ORD-9012',
    salesperson: 'Rohan Shah',
    driverName: 'Suresh Kumar',
    vehicleNo: 'GJ-18-TT-9988',
    deliveryDetails: 'Direct delivery to site store keeper.',
    status: 'Dispatched',
    items: [
      {
        sku: 'CP-DIV-3WAY',
        productName: 'Single Lever 3-Way Concealed Diverter Complete',
        description: 'Chrome finish 3-way diverter kit',
        quantity: 10,
        unit: 'Set'
      }
    ],
    remarks: 'Full dispatch for confirmed quotation QT-2026-002'
  }
];

export const getChallans = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/challans', { params: queryParams });
    const rawList = extractArray(res.data, ['challans']);
    return { data: rawList, total: res.data?.data?.pagination?.total || res.data?.total || rawList.length };
  } catch (err) {}

  return { data: [], total: 0 };
};

export const getChallanById = async (id) => {
  try {
    const res = await api.get(`/challans/${id}`);
    return res.data;
  } catch (err) {}
  const ch = MOCK_CHALLANS.find(c => c.id === id || c.challanNumber === id);
  if (!ch) throw new Error('Challan not found');
  return ch;
};

export const createChallan = async (challanData) => {
  try {
    const res = await api.post('/challans', challanData);
    return res.data;
  } catch (err) {
    const newCh = {
      id: `CH-2026-00${MOCK_CHALLANS.length + 1}`,
      challanNumber: `CH-2026-00${MOCK_CHALLANS.length + 1}`,
      date: challanData.date || new Date().toISOString().split('T')[0],
      status: challanData.status || 'Dispatched',
      ...challanData
    };
    MOCK_CHALLANS.unshift(newCh);
    return newCh;
  }
};
