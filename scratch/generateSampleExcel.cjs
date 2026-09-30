const XLSX = require('../server/node_modules/xlsx');
const path = require('path');
const fs = require('fs');

const sampleRows = [
  {
    'Product code': 'SOM-STAT-60120',
    'Global Code': 'A10293847',
    'Product Category': 'Tiles',
    'RANGE/ SIZE': '600x1200mm (2x4 Ft)',
    'FULL DESCRIPTION': '', // Optional / Blank for Tiles (System auto-generates name)
    'Product Type': 'Glazed Vitrified Tiles',
    'Product Sub Type': 'High Gloss GVT',
    'COLOUR NAME': 'Statuario White',
    'COMPANY': 'Somany',
    'HSN Code': '69072100',
    'SEGMENT': 'Premium',
    'FACTOR': 1,
    'EX-DEPO': 480,
    'MRP': 790,
    'GST Rate (%)': 18,
    'Stock Qty': 150,
    'Pcs Per Box': 2,
    'Coverage Area (Sq.Ft)': 15.5,
    'Weight Per Box (kg)': 29.0,
    'PRODUCT IMAGE': '', // Embedded image can be pasted in Excel
    'Product Status': 'Active'
  },
  {
    'Product code': 'SOM-ONYX-120240',
    'Global Code': 'A10293848',
    'Product Category': 'Tiles',
    'RANGE/ SIZE': '1200x2400mm (4x8 Ft)',
    'FULL DESCRIPTION': '', // Optional / Blank for Tiles
    'Product Type': 'Porcelain Slabs',
    'Product Sub Type': 'Bookmatch Slabs',
    'COLOUR NAME': 'Royal Onyx Jade Gold',
    'COMPANY': 'Somany',
    'HSN Code': '69072100',
    'SEGMENT': 'Luxury',
    'FACTOR': 1,
    'EX-DEPO': 2400,
    'MRP': 3850,
    'GST Rate (%)': 18,
    'Stock Qty': 40,
    'Pcs Per Box': 1,
    'Coverage Area (Sq.Ft)': 31.0,
    'Weight Per Box (kg)': 62.0,
    'PRODUCT IMAGE': '',
    'Product Status': 'Active'
  },
  {
    'Product code': 'RS327702000',
    'Global Code': 'A801732004',
    'Product Category': 'Sanitaryware',
    'RANGE/ SIZE': 'Inspira',
    'FULL DESCRIPTION': 'Roca Inspira Round Rimless Wall Hung WC with Soft Close UF Seat Cover White',
    'Product Type': 'Water Closet',
    'Product Sub Type': 'Wall Hung WC',
    'COLOUR NAME': 'Glossy White',
    'COMPANY': 'ROCA',
    'HSN Code': '69109000',
    'SEGMENT': 'Collection Inspira',
    'FACTOR': 1,
    'EX-DEPO': 14500,
    'MRP': 22500,
    'GST Rate (%)': 18,
    'Stock Qty': 25,
    'Pcs Per Box': 1,
    'Coverage Area (Sq.Ft)': 0,
    'Weight Per Box (kg)': 24.5,
    'PRODUCT IMAGE': '',
    'Product Status': 'Active'
  },
  {
    'Product code': 'RS327700000',
    'Global Code': 'A327700000',
    'Product Category': 'Sanitaryware',
    'RANGE/ SIZE': 'L90',
    'FULL DESCRIPTION': 'Roca L90 Countertop Vessel Wash Basin 550x420mm White',
    'Product Type': 'Wash Basin',
    'Product Sub Type': 'Countertop Basin',
    'COLOUR NAME': 'White',
    'COMPANY': 'ROCA',
    'HSN Code': '69109000',
    'SEGMENT': 'Collection L90',
    'FACTOR': 1,
    'EX-DEPO': 4800,
    'MRP': 7400,
    'GST Rate (%)': 18,
    'Stock Qty': 30,
    'Pcs Per Box': 1,
    'Coverage Area (Sq.Ft)': 0,
    'Weight Per Box (kg)': 12.0,
    'PRODUCT IMAGE': '',
    'Product Status': 'Active'
  },
  {
    'Product code': 'RS5A3296C00',
    'Global Code': 'A5A3296C00',
    'Product Category': 'Faucets',
    'RANGE/ SIZE': 'Inspira Round',
    'FULL DESCRIPTION': 'Roca Inspira High Neck Basin Mixer Chrome Finish with Cold Start',
    'Product Type': 'Basin Mixer',
    'Product Sub Type': 'Tall Body Mixer',
    'COLOUR NAME': 'Chrome',
    'COMPANY': 'ROCA',
    'HSN Code': '84818020',
    'SEGMENT': 'Collection Inspira',
    'FACTOR': 1,
    'EX-DEPO': 3200,
    'MRP': 5100,
    'GST Rate (%)': 18,
    'Stock Qty': 50,
    'Pcs Per Box': 1,
    'Coverage Area (Sq.Ft)': 0,
    'Weight Per Box (kg)': 2.5,
    'PRODUCT IMAGE': '',
    'Product Status': 'Active'
  }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(sampleRows);

ws['!cols'] = [
  { wch: 18 }, // Product code / SKUCODE
  { wch: 16 }, // Global Code
  { wch: 18 }, // Product Category
  { wch: 22 }, // RANGE/ SIZE
  { wch: 45 }, // FULL DESCRIPTION
  { wch: 24 }, // Product Type
  { wch: 20 }, // Product Sub Type
  { wch: 20 }, // COLOUR NAME
  { wch: 15 }, // COMPANY
  { wch: 14 }, // HSN Code
  { wch: 14 }, // SEGMENT
  { wch: 10 }, // FACTOR
  { wch: 15 }, // EX-DEPO
  { wch: 14 }, // MRP
  { wch: 12 }, // GST Rate (%)
  { wch: 12 }, // Stock Qty
  { wch: 12 }, // Pcs Per Box
  { wch: 20 }, // Coverage Area (Sq.Ft)
  { wch: 18 }, // Weight Per Box (kg)
  { wch: 16 }, // PRODUCT IMAGE
  { wch: 14 }  // Product Status
];

XLSX.utils.book_append_sheet(wb, ws, 'Products Template');

const outputPath = path.join(__dirname, '../Maitri_Ceramic_Master_Product_Import_Sample.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('✅ Master sample Excel successfully generated at:', outputPath);
