const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

const loadSalesReport = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const statsData = await getStats(startOfMonth, endOfMonth);
        
        console.log('Stats Data:', statsData); 

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
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Error in loadSalesReport:', error);
        res.redirect('/admin/pageError');
    }
};
const filterSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, dateRange } = req.body;
        let start, end;

        if (dateRange && dateRange !== 'custom') {
            const today = new Date();
            
            switch(dateRange) {
                case 'today':
                    start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                    break;
                case 'week':
                    // Get the first day of the current week (Sunday)
                    start = new Date(today);
                    start.setDate(today.getDate() - today.getDay());
                    start.setHours(0, 0, 0, 0);
                    
                    // Get the last day of the current week (Saturday)
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

        const stats = await getStats(start, end);
        const orders = await Order.find({
            createdOn: { $gte: start, $lte: end }
        })
        .populate('userId', 'name')
        .sort({ createdOn: -1 });

        res.json({
            stats,
            orders,
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
module.exports = {
    loadSalesReport,
    filterSalesReport
};