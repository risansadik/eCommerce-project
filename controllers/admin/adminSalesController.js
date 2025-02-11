const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

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
                    status: { $nin: ['Cancelled'] }
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

        console.log('Aggregation Stats Raw:', stats);


        if (stats.length === 0) {
            console.log('No orders found in the specified date range');
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
module.exports = {
    loadSalesReport,
    filterSalesReport
};