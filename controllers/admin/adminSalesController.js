const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const ExcelJS = require('exceljs');

const loadSalesReport = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const [statsData, chartData, topProducts, topCategories] = await Promise.all([
            getStats(startOfMonth, endOfMonth),
            generateChartData(),
            getTopProducts(startOfMonth, endOfMonth),
            getTopCategories(startOfMonth, endOfMonth)
        ]);

        const orders = await Order.find({
            createdOn: { $gte: startOfMonth, $lte: endOfMonth }
        })
            .populate('userId', 'name')
            .sort({ createdOn: -1 });

        const stats = {
            salesCount: statsData.salesCount || 0,
            orderAmount: statsData.orderAmount || 0,
            discount: statsData.discount || 0
        };

        res.render('admin-dashboard', {
            stats,
            orders,
            topProducts,
            topCategories,
            chartData: JSON.stringify(chartData),
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Error in loadSalesReport:', error);
        res.redirect('/admin/pageError');
    }
};

async function generateChartData() {
    const today = new Date();

   
    const dailyData = await Order.aggregate([
        {
            $match: {
                createdOn: {
                    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
                    $lte: today
                },
                status: { $nin: ['Cancelled'] }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
                sales: { $sum: "$finalAmount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

   
    const weeklyData = await Order.aggregate([
        {
            $match: {
                createdOn: {
                    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 28),
                    $lte: today
                },
                status: { $nin: ['Cancelled'] }
            }
        },
        {
            $group: {
                _id: {
                    week: { $week: "$createdOn" },
                    year: { $year: "$createdOn" }
                },
                sales: { $sum: "$finalAmount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } }
    ]);

  
    const monthlyData = await Order.aggregate([
        {
            $match: {
                createdOn: {
                    $gte: new Date(today.getFullYear() - 1, today.getMonth(), 1),
                    $lte: today
                },
                status: { $nin: ['Cancelled'] }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdOn" },
                    month: { $month: "$createdOn" }
                },
                sales: { $sum: "$finalAmount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    
    const yearlyData = await Order.aggregate([
        {
            $match: {
                createdOn: {
                    $gte: new Date(today.getFullYear() - 4, 0, 1),
                    $lte: today
                },
                status: { $nin: ['Cancelled'] }
            }
        },
        {
            $group: {
                _id: { $year: "$createdOn" },
                sales: { $sum: "$finalAmount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
        daily: {
            labels: dailyData.map(item => new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            sales: dailyData.map(item => item.sales),
            count: dailyData.map(item => item.count)
        },
        weekly: {
            labels: weeklyData.map(item => `Week ${item._id.week}`),
            sales: weeklyData.map(item => item.sales),
            count: weeklyData.map(item => item.count)
        },
        monthly: {
            labels: monthlyData.map(item => `${months[item._id.month - 1]} ${item._id.year}`),
            sales: monthlyData.map(item => item.sales),
            count: monthlyData.map(item => item.count)
        },
        yearly: {
            labels: yearlyData.map(item => item._id.toString()),
            sales: yearlyData.map(item => item.sales),
            count: yearlyData.map(item => item.count)
        }
    };
}
const filterSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, dateRange } = req.body;
        let start, end;

        if (dateRange && dateRange !== 'custom') {
            const today = new Date();

            switch (dateRange) {
                case 'today':
                    start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                    break;
                case 'week':
                    
                    start = new Date(today);
                    start.setDate(today.getDate() - today.getDay());
                    start.setHours(0, 0, 0, 0);

                    
                    end = new Date(today);
                    end.setDate(today.getDate() + (6 - today.getDay()));
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'year':
                    start = new Date(today.getFullYear(), 0, 1);
                    end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
                    break;
                default:
                    throw new Error('Invalid date range');
            }
        } else {

            if (!startDate || !endDate) {
                throw new Error('Start date and end date are required for custom range');
            }

            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid date format');
            }
        }

        const [stats, orders, topProducts, topCategories] = await Promise.all([
            getStats(start, end),
            Order.find({
                createdOn: { $gte: start, $lte: end }
            })
                .populate('userId', 'name')
                .sort({ createdOn: -1 }),
            getTopProducts(start, end),
            getTopCategories(start, end)
        ]);

        res.json({
            stats,
            orders,
            topProducts,
            topCategories,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Error in filterSalesReport:', error);
        res.status(500).json({
            error: error.message || 'Internal server error',
            success: false
        });
    }
};

async function getStats(startDate, endDate) {
    try {
        const stats = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: startDate, $lte: endDate },
                    status: { $nin: ['Cancelled' , 'Returned'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: '$totalPrice' },
                    totalDiscount: { $sum: '$discount' }
                }
            }
        ]);



        if (stats.length === 0) {
            return {
                salesCount: 0,
                orderAmount: 0,
                discount: 0
            };
        }

        return {
            salesCount: stats[0].totalOrders || 0,
            orderAmount: stats[0].totalAmount || 0,
            discount: stats[0].totalDiscount || 0
        };
    } catch (error) {
        console.error('Error in getStats aggregation:', error);
        return {
            salesCount: 0,
            orderAmount: 0,
            discount: 0
        };
    }
}

async function getTopProducts(startDate, endDate) {
    try {
        const topProducts = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: startDate, $lte: endDate },
                    status: { $nin: ['Cancelled'] }
                }
            },
            { $unwind: '$orderedItems' },
            {
                $match: {
                    'orderedItems.status': 'Active'
                }
            },
            {
                $group: {
                    _id: '$orderedItems.product',
                    totalQuantity: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $project: {
                    productName: '$productDetails.productName',
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        return topProducts;
    } catch (error) {
        console.error('Error in getTopProducts:', error);
        return [];
    }
}

async function getTopCategories(startDate, endDate) {
    try {
        const topCategories = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: startDate, $lte: endDate },
                    status: { $nin: ['Cancelled'] }
                }
            },
            { $unwind: '$orderedItems' },
            {
                $match: {
                    'orderedItems.status': 'Active'
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderedItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$productDetails.category',
                    totalQuantity: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: '$categoryDetails' },
            {
                $project: {
                    categoryName: '$categoryDetails.name',
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        return topCategories;
    } catch (error) {
        console.error('Error in getTopCategories:', error);
        return [];
    }
}

const downloadExcel = async (req, res) => {
    try {
        const { dateRange, startDate, endDate } = req.body;
        let start, end;

        if (dateRange && dateRange !== 'custom') {
            const today = new Date();

            switch (dateRange) {
                case 'today':
                    start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                    break;
                case 'week':
                    start = new Date(today);
                    start.setDate(today.getDate() - today.getDay());
                    start.setHours(0, 0, 0, 0);
                    end = new Date(today);
                    end.setDate(today.getDate() + (6 - today.getDay()));
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'year':
                    start = new Date(today.getFullYear(), 0, 1);
                    end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
                    break;
                default:
                    throw new Error('Invalid date range');
            }
        } else {
            if (!startDate || !endDate) {
                throw new Error('Start date and end date are required for custom range');
            }

            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        const [stats, orders, topProducts, topCategories] = await Promise.all([
            getStats(start, end),
            Order.find({
                createdOn: { $gte: start, $lte: end }
            })
                .populate('userId', 'name')
                .sort({ createdOn: -1 }),
            getTopProducts(start, end),
            getTopCategories(start, end)
        ]);

        // Create a new workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sales Report System';
        workbook.created = new Date();

        // Create Summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 20 },
            { header: 'Value', key: 'value', width: 15 }
        ];

        // Add summary data
        summarySheet.addRows([
            { metric: 'Total Sales Count', value: stats.salesCount },
            { metric: 'Total Order Amount', value: stats.orderAmount },
            { metric: 'Total Discount', value: stats.discount }
        ]);

        // Style summary sheet
        summarySheet.getRow(1).font = { bold: true };
        summarySheet.getColumn('value').numFmt = '₹#,##0.00';

        // Create Orders sheet
        const ordersSheet = workbook.addWorksheet('Orders');
        ordersSheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 15 },
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Customer', key: 'customer', width: 20 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        // Add orders data
        orders.forEach(order => {
            ordersSheet.addRow({
                orderId: order.orderId,
                date: new Date(order.createdOn).toLocaleDateString(),
                customer: order.userId.name,
                amount: order.totalPrice,
                discount: order.discount,
                finalAmount: order.finalAmount,
                status: order.status
            });
        });

        // Style orders sheet
        ordersSheet.getRow(1).font = { bold: true };
        ['amount', 'discount', 'finalAmount'].forEach(col => {
            ordersSheet.getColumn(col).numFmt = '₹#,##0.00';
        });

        // Create Top Products sheet
        const productsSheet = workbook.addWorksheet('Top Products');
        productsSheet.columns = [
            { header: 'Product Name', key: 'name', width: 30 },
            { header: 'Quantity Sold', key: 'quantity', width: 15 },
            { header: 'Revenue', key: 'revenue', width: 15 }
        ];

        // Add products data
        topProducts.forEach(product => {
            productsSheet.addRow({
                name: product.productName,
                quantity: product.totalQuantity,
                revenue: product.totalRevenue
            });
        });

        // Style products sheet
        productsSheet.getRow(1).font = { bold: true };
        productsSheet.getColumn('revenue').numFmt = '₹#,##0.00';

        // Create Top Categories sheet
        const categoriesSheet = workbook.addWorksheet('Top Categories');
        categoriesSheet.columns = [
            { header: 'Category Name', key: 'name', width: 30 },
            { header: 'Quantity Sold', key: 'quantity', width: 15 },
            { header: 'Revenue', key: 'revenue', width: 15 }
        ];

        // Add categories data
        topCategories.forEach(category => {
            categoriesSheet.addRow({
                name: category.categoryName,
                quantity: category.totalQuantity,
                revenue: category.totalRevenue
            });
        });

        // Style categories sheet
        categoriesSheet.getRow(1).font = { bold: true };
        categoriesSheet.getColumn('revenue').numFmt = '₹#,##0.00';

        // Write to buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Send response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${new Date().toISOString().split('T')[0]}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Error in downloadExcel:', error);
        res.status(500).json({
            error: error.message || 'Internal server error',
            success: false
        });
    }
};
module.exports = {
    loadSalesReport,
    filterSalesReport,
    downloadExcel
};