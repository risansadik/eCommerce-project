const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('orderedItems.product', 'productName')
            .populate('userId', 'name email phone')
            .sort({ createdOn: -1 });

        const processedOrders = await Promise.all(orders.map(async (order) => {
            try {
                // Try to find the address document using multiple strategies
                let addressDocument = null;

                // Strategy 1: Direct lookup by _id
                addressDocument = await Address.findById(order.address);

                // Strategy 2: If direct lookup fails, try finding by nested _id
                if (!addressDocument) {
                    addressDocument = await Address.findOne({ 
                        userId: order.userId,
                        'address._id': order.address 
                    });
                }

                // Logging for debugging
                console.log('Address Lookup Strategies:', {
                    orderId: order.orderId,
                    addressId: order.address,
                    directLookupFound: !!addressDocument,
                    nestedLookupFound: addressDocument ? 'Yes' : 'No'
                });

                // If no address found, use fallback
                if (!addressDocument) {
                    return {
                        ...order._doc,
                        address: {
                            name: 'N/A',
                            street: 'N/A',
                            city: 'N/A',
                            state: 'N/A',
                            pincode: 'N/A',
                            phone: 'N/A'
                        }
                    };
                }

                // Find the specific address in the nested array
                const addressData = addressDocument.address.find(
                    addr => addr._id.toString() === order.address.toString()
                ) || addressDocument.address[0];

                return {
                    ...order._doc,
                    address: {
                        name: addressData.name || 'N/A',
                        street: addressData.landmark || 'N/A', 
                        city: addressData.city || 'N/A',
                        state: addressData.state || 'N/A',
                        pincode: addressData.pincode || 'N/A',
                        phone: addressData.phone || addressData.altPhone || 'N/A'
                    }
                };
            } catch (addressError) {
                console.error(`Address processing error for order ${order.orderId}:`, addressError);
                return {
                    ...order._doc,
                    address: {
                        name: 'N/A',
                        street: 'N/A',
                        city: 'N/A',
                        state: 'N/A',
                        pincode: 'N/A',
                        phone: 'N/A'
                    }
                };
            }
        }));

        res.render('admin-orders', {
            orders: processedOrders,
            title: 'Order Management'
        });
    } catch (error) {
        console.error('Comprehensive Order Fetch Error:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).render('error', {
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
};
const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .populate('userId', 'name email phone')
            .populate('address');

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        // Get the address details from the nested array
        const addressDetails = order.address && order.address.address && order.address.address.length > 0
            ? order.address.address[0]
            : null;

        const processedOrder = {
            ...order._doc,
            address: {
                name: addressDetails?.name || order.userId?.name || 'N/A',
                street: addressDetails?.landmark || 'N/A',
                city: addressDetails?.city || 'N/A',
                state: addressDetails?.state || 'N/A',
                pincode: addressDetails?.pincode || 'N/A',
                phone: addressDetails?.phone || addressDetails?.altPhone || order.userId?.phone || 'N/A'
            }
        };

        console.log(addressDetails);
        res.render('admin/order-details', {
            order: processedOrder,
            title: 'Order Details'
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', { message: 'Failed to fetch order details' });
    }
};
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Don't allow status changes for cancelled orders
        if (order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update status of cancelled order'
            });
        }

        // Update status
        order.status = status;
        await order.save();

        // If order is cancelled, restore product quantities
        if (status === 'Cancelled') {
            for (const item of order.orderedItems) {
                await Product.updateOne(
                    {
                        _id: item.product,
                        'sizeVariants.size': item.size
                    },
                    {
                        $inc: { 'sizeVariants.$.quantity': item.quantity }
                    }
                );
            }
        }

        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
};

// Add cancel order functionality
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be cancelled
        if (['Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel order at this stage'
            });
        }

        // Restore product quantities
        for (const item of order.orderedItems) {
            await Product.updateOne(
                {
                    _id: item.product,
                    'sizeVariants.size': item.size
                },
                {
                    $inc: { 'sizeVariants.$.quantity': item.quantity }
                }
            );
        }

        order.status = 'Cancelled';
        await order.save();

        res.json({
            success: true,
            message: 'Order cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
};



module.exports = {
    getAllOrders,
    getOrderDetails,
    updateOrderStatus,
    cancelOrder
};