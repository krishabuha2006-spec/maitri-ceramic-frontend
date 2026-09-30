const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const fix = async () => {
  try {
    await mongoose.connect('mongodb+srv://laxsavani:laxsavani@cluster0.ykxfhke.mongodb.net/Maitri-Cermic');
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

    const knownPrices = {
      'SOM-STAT-60120': { mrp: 790, salePrice: 790, purchaseRate: 480 },
      'SOM-ONYX-120240': { mrp: 3850, salePrice: 3850, purchaseRate: 2400 },
      'ROCA-INSP-WC-01': { mrp: 22500, salePrice: 22500, purchaseRate: 14500 },
      'ROCA-L90-BASIN': { mrp: 7400, salePrice: 7400, purchaseRate: 4800 },
      'ROCA-INSP-FAUCET': { mrp: 5100, salePrice: 5100, purchaseRate: 3200 }
    };

    const all = await Product.find({});
    for (const p of all) {
      const sku = p.companySkuCode || p.sku;
      if (sku && knownPrices[sku]) {
        await Product.updateOne(
          { _id: p._id },
          {
            $set: {
              mrp: knownPrices[sku].mrp,
              salePrice: knownPrices[sku].salePrice,
              purchaseRate: knownPrices[sku].purchaseRate
            }
          }
        );
      } else if (!p.mrp || p.mrp === 0) {
        const fallbackMrp = p.salePrice || (p.purchaseRate ? Math.round(p.purchaseRate * 1.5) : 1000);
        await Product.updateOne(
          { _id: p._id },
          {
            $set: {
              mrp: fallbackMrp,
              salePrice: p.salePrice || fallbackMrp
            }
          }
        );
      }
    }

    const updatedList = await Product.find().lean();
    console.log('✅ Updated products in MongoDB:');
    console.log(
      JSON.stringify(
        updatedList.map(p => ({
          sku: p.companySkuCode,
          name: p.productName,
          mrp: p.mrp,
          salePrice: p.salePrice,
          purchaseRate: p.purchaseRate
        })),
        null,
        2
      )
    );
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing prices:', err.message);
    process.exit(1);
  }
};

fix();
