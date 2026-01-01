import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Clean existing data
    await prisma.bomLine.deleteMany();
    await prisma.saleLine.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.transferLine.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.purchaseOrderLine.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.inventoryBalance.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.user.deleteMany();
    await prisma.location.deleteMany();
    await prisma.company.deleteMany();

    // Create Company
    const company = await prisma.company.create({
        data: { name: 'FreshMart Supermarkets' },
    });

    // Create Locations
    const warehouse = await prisma.location.create({
        data: {
            companyId: company.id,
            type: 'WAREHOUSE',
            name: 'Central Warehouse',
            address: 'Industrial Area, Lagos',
        },
    });

    const branch1 = await prisma.location.create({
        data: {
            companyId: company.id,
            type: 'BRANCH',
            name: 'Victoria Island Branch',
            address: 'Adeola Odeku Street, VI',
        },
    });

    const branch2 = await prisma.location.create({
        data: {
            companyId: company.id,
            type: 'BRANCH',
            name: 'Lekki Branch',
            address: 'Admiralty Way, Lekki Phase 1',
        },
    });

    const branch3 = await prisma.location.create({
        data: {
            companyId: company.id,
            type: 'BRANCH',
            name: 'Ikeja Branch',
            address: 'Allen Avenue, Ikeja',
        },
    });

    // Create Users
    await prisma.user.createMany({
        data: [
            { companyId: company.id, email: 'owner@freshmart.com', name: 'John Owner', role: 'OWNER' },
            { companyId: company.id, locationId: warehouse.id, email: 'warehouse@freshmart.com', name: 'Warehouse Manager', role: 'MANAGER' },
            { companyId: company.id, locationId: branch1.id, email: 'vi@freshmart.com', name: 'VI Branch Manager', role: 'MANAGER' },
            { companyId: company.id, locationId: branch2.id, email: 'lekki@freshmart.com', name: 'Lekki Branch Manager', role: 'MANAGER' },
            { companyId: company.id, locationId: branch3.id, email: 'ikeja@freshmart.com', name: 'Ikeja Branch Manager', role: 'MANAGER' },
            { companyId: company.id, locationId: branch1.id, email: 'staff1@freshmart.com', name: 'Sales Staff 1', role: 'STAFF' },
        ],
    });

    // Create Suppliers
    const supplierDrinks = await prisma.supplier.create({
        data: { companyId: company.id, name: 'Nigerian Bottling Company', phone: '08012345678', email: 'orders@nbc.com' },
    });

    const supplierGrocery = await prisma.supplier.create({
        data: { companyId: company.id, name: 'Dangote Foods', phone: '08087654321', email: 'sales@dangote.com' },
    });

    const supplierDairy = await prisma.supplier.create({
        data: { companyId: company.id, name: 'FrieslandCampina', phone: '08055555555', email: 'orders@friesland.com' },
    });

    // Create Categories
    const catBeverages = await prisma.category.create({ data: { companyId: company.id, name: 'Beverages' } });
    const catGrocery = await prisma.category.create({ data: { companyId: company.id, name: 'Grocery' } });
    const catDairy = await prisma.category.create({ data: { companyId: company.id, name: 'Dairy & Cold' } });
    const catSnacks = await prisma.category.create({ data: { companyId: company.id, name: 'Snacks & Confectionery' } });
    const catPersonal = await prisma.category.create({ data: { companyId: company.id, name: 'Personal Care' } });

    // Create Products
    const products = await Promise.all([
        prisma.product.create({ data: { companyId: company.id, categoryId: catBeverages.id, sku: 'BEV001', name: 'Coca-Cola 50cl', unit: 'bottle', costPrice: 150, sellingPrice: 200, reorderLevel: 100 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catBeverages.id, sku: 'BEV002', name: 'Fanta Orange 50cl', unit: 'bottle', costPrice: 150, sellingPrice: 200, reorderLevel: 80 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catBeverages.id, sku: 'BEV003', name: 'Sprite 50cl', unit: 'bottle', costPrice: 150, sellingPrice: 200, reorderLevel: 80 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catBeverages.id, sku: 'BEV004', name: 'Eva Water 75cl', unit: 'bottle', costPrice: 100, sellingPrice: 150, reorderLevel: 200 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catBeverages.id, sku: 'BEV005', name: 'Malt Drink 50cl', unit: 'bottle', costPrice: 180, sellingPrice: 250, reorderLevel: 60 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO001', name: 'Golden Penny Semovita 2kg', unit: 'pack', costPrice: 1800, sellingPrice: 2200, reorderLevel: 50 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO002', name: 'Indomie Noodles (Carton)', unit: 'carton', costPrice: 4500, sellingPrice: 5500, reorderLevel: 30 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO003', name: 'Dangote Rice 50kg', unit: 'bag', costPrice: 45000, sellingPrice: 52000, reorderLevel: 20 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO004', name: 'Golden Penny Flour 2kg', unit: 'pack', costPrice: 1500, sellingPrice: 1800, reorderLevel: 40 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO005', name: 'Kings Vegetable Oil 3L', unit: 'bottle', costPrice: 3500, sellingPrice: 4200, reorderLevel: 30 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO006', name: 'Dangote Sugar 1kg', unit: 'pack', costPrice: 1200, sellingPrice: 1500, reorderLevel: 80 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catGrocery.id, sku: 'GRO007', name: 'Maggi Cubes (Pack of 100)', unit: 'pack', costPrice: 800, sellingPrice: 1000, reorderLevel: 50 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catDairy.id, sku: 'DAI001', name: 'Peak Milk Tin 400g', unit: 'tin', costPrice: 1400, sellingPrice: 1750, reorderLevel: 60, trackExpiry: true } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catDairy.id, sku: 'DAI002', name: 'Three Crowns Milk 400g', unit: 'tin', costPrice: 1200, sellingPrice: 1500, reorderLevel: 60, trackExpiry: true } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catDairy.id, sku: 'DAI003', name: 'Chi Hollandia Yoghurt 1L', unit: 'bottle', costPrice: 900, sellingPrice: 1200, reorderLevel: 40, trackExpiry: true } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catDairy.id, sku: 'DAI004', name: 'Blue Band Margarine 250g', unit: 'tub', costPrice: 650, sellingPrice: 850, reorderLevel: 50, trackExpiry: true } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catSnacks.id, sku: 'SNK001', name: 'Gala Sausage Roll', unit: 'piece', costPrice: 180, sellingPrice: 250, reorderLevel: 100 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catSnacks.id, sku: 'SNK002', name: 'Biscuit Cabin (Pack)', unit: 'pack', costPrice: 100, sellingPrice: 150, reorderLevel: 150 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catSnacks.id, sku: 'SNK003', name: 'Digestive Biscuit', unit: 'pack', costPrice: 350, sellingPrice: 500, reorderLevel: 60 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catSnacks.id, sku: 'SNK004', name: 'Pringles Chips', unit: 'can', costPrice: 1200, sellingPrice: 1600, reorderLevel: 30 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catPersonal.id, sku: 'PER001', name: 'Close Up Toothpaste 140g', unit: 'tube', costPrice: 450, sellingPrice: 600, reorderLevel: 40 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catPersonal.id, sku: 'PER002', name: 'Dettol Soap (Pack of 6)', unit: 'pack', costPrice: 1200, sellingPrice: 1500, reorderLevel: 30 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catPersonal.id, sku: 'PER003', name: 'Sunsilk Shampoo 400ml', unit: 'bottle', costPrice: 1500, sellingPrice: 1900, reorderLevel: 25 } }),
        prisma.product.create({ data: { companyId: company.id, categoryId: catPersonal.id, sku: 'PER004', name: 'Vaseline Petroleum Jelly 100ml', unit: 'jar', costPrice: 400, sellingPrice: 550, reorderLevel: 50 } }),
    ]);

    console.log(`✅ Created ${products.length} products`);

    // Create Inventory Balances
    const allLocations = [warehouse, branch1, branch2, branch3];
    for (const product of products) {
        for (const location of allLocations) {
            const baseQty = location.type === 'WAREHOUSE' ? 500 : 80;
            const variance = Math.floor(Math.random() * 50) - 25;
            await prisma.inventoryBalance.create({
                data: { productId: product.id, locationId: location.id, onHand: Math.max(0, baseQty + variance), reserved: 0 },
            });
        }
    }
    console.log('✅ Created inventory balances');

    // Create Purchase Orders
    const po1 = await prisma.purchaseOrder.create({
        data: {
            companyId: company.id, supplierId: supplierDrinks.id, locationId: warehouse.id, status: 'RECEIVED',
            lines: {
                create: [
                    { productId: products[0].id, qtyOrdered: 500, qtyReceived: 500, unitCost: 150 },
                    { productId: products[1].id, qtyOrdered: 300, qtyReceived: 300, unitCost: 150 },
                    { productId: products[2].id, qtyOrdered: 300, qtyReceived: 300, unitCost: 150 },
                ]
            },
        },
    });

    await prisma.purchaseOrder.create({
        data: {
            companyId: company.id, supplierId: supplierGrocery.id, locationId: warehouse.id, status: 'PENDING',
            lines: {
                create: [
                    { productId: products[5].id, qtyOrdered: 100, qtyReceived: 0, unitCost: 1800 },
                    { productId: products[6].id, qtyOrdered: 50, qtyReceived: 0, unitCost: 4500 },
                    { productId: products[7].id, qtyOrdered: 30, qtyReceived: 0, unitCost: 45000 },
                ]
            },
        },
    });

    await prisma.purchaseOrder.create({
        data: {
            companyId: company.id, supplierId: supplierDairy.id, locationId: warehouse.id, status: 'PARTIALLY_RECEIVED',
            lines: {
                create: [
                    { productId: products[12].id, qtyOrdered: 200, qtyReceived: 100, unitCost: 1400 },
                    { productId: products[13].id, qtyOrdered: 200, qtyReceived: 200, unitCost: 1200 },
                ]
            },
        },
    });
    console.log('✅ Created purchase orders');

    // Create Transfers
    const transfer1 = await prisma.transfer.create({
        data: {
            companyId: company.id, fromLocationId: warehouse.id, toLocationId: branch1.id, status: 'RECEIVED',
            lines: {
                create: [
                    { productId: products[0].id, qty: 100, unitCost: 150 },
                    { productId: products[3].id, qty: 200, unitCost: 100 },
                ]
            },
        },
    });

    await prisma.transfer.create({
        data: {
            companyId: company.id, fromLocationId: warehouse.id, toLocationId: branch2.id, status: 'IN_TRANSIT',
            lines: {
                create: [
                    { productId: products[5].id, qty: 30, unitCost: 1800 },
                    { productId: products[6].id, qty: 20, unitCost: 4500 },
                ]
            },
        },
    });
    console.log('✅ Created transfers');

    // Create Sample Sales (last 30 days)
    const now = new Date();
    const branches = [branch1, branch2, branch3];
    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
        const saleDate = new Date(now);
        saleDate.setDate(saleDate.getDate() - daysAgo);
        for (const branch of branches) {
            const salesCount = Math.floor(Math.random() * 6) + 3;
            for (let s = 0; s < salesCount; s++) {
                const lineCount = Math.floor(Math.random() * 5) + 1;
                const lines: { productId: string; qty: number; unitPrice: number; unitCost: number }[] = [];
                for (let l = 0; l < lineCount; l++) {
                    const randomProduct = products[Math.floor(Math.random() * products.length)];
                    lines.push({ productId: randomProduct.id, qty: Math.floor(Math.random() * 5) + 1, unitPrice: randomProduct.sellingPrice, unitCost: randomProduct.costPrice });
                }
                const totalAmount = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
                await prisma.sale.create({ data: { companyId: company.id, locationId: branch.id, totalAmount, createdAt: saleDate, lines: { create: lines } } });
            }
        }
    }
    console.log('✅ Created sample sales');

    // Create stock movements
    await prisma.stockMovement.createMany({
        data: [
            { companyId: company.id, productId: products[0].id, toLocationId: warehouse.id, type: 'PURCHASE_RECEIPT', qty: 500, unitCost: 150, referenceType: 'PurchaseOrder', referenceId: po1.id },
            { companyId: company.id, productId: products[1].id, toLocationId: warehouse.id, type: 'PURCHASE_RECEIPT', qty: 300, unitCost: 150, referenceType: 'PurchaseOrder', referenceId: po1.id },
            { companyId: company.id, productId: products[2].id, toLocationId: warehouse.id, type: 'PURCHASE_RECEIPT', qty: 300, unitCost: 150, referenceType: 'PurchaseOrder', referenceId: po1.id },
            { companyId: company.id, productId: products[0].id, fromLocationId: warehouse.id, type: 'TRANSFER_OUT', qty: 100, unitCost: 150, referenceType: 'Transfer', referenceId: transfer1.id },
            { companyId: company.id, productId: products[0].id, toLocationId: branch1.id, type: 'TRANSFER_IN', qty: 100, unitCost: 150, referenceType: 'Transfer', referenceId: transfer1.id },
        ],
    });
    console.log('✅ Created stock movements');
    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => { console.error('❌ Error seeding database:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
