const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const mongoose = require('mongoose');


const createOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId, paymentMethod } = req.body;

        // Validate address
        const addressDocument = await Address.findOne({
            _id: addressId,
            userId: userId
        });

        if (!addressDocument) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or unauthorized address'
            });
        }

        // Get cart
        const cart = await Cart.findOne({ userId })
            .populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cart is empty' 
            });
        }

        // Validate stock and prepare order items
        let totalPrice = 0;
        let orderItems = [];

        for (const item of cart.items) {
            const product = item.productId;
            const sizeVariant = product.sizeVariants.find(v => v.size === item.size);
            
            if (!sizeVariant || sizeVariant.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `${product.productName} (${item.size}) is out of stock`
                });
            }

            totalPrice += item.totalPrice;
            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: (item.price / item.quantity),
                size: item.size
            });
        }

        // Create order
        const order = new Order({
            userId: userId,
            orderedItems: orderItems,
            totalPrice,
            finalAmount: totalPrice,
            address: addressDocument._id,
            status: 'Pending',
            invoiceDate: new Date()
        });

        // Save order
        await order.save();

        // Update product inventory
        for (const item of cart.items) {
            await Product.updateOne(
                {
                    _id: item.productId,
                    'sizeVariants.size': item.size
                },
                {
                    $inc: { 'sizeVariants.$.quantity': -item.quantity }
                }
            );
        }

        // Clear cart
        await Cart.findByIdAndDelete(cart._id);

        return res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order.orderId
        });

    } catch (error) {
        console.error('Order Creation Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        return res.status(500).json({
            success: false,
            message: 'Failed to create order',
            errorDetails: error.message
        });
    }
};


const getUserOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Fetch orders directly instead of through user document
        const orders = await Order.find({ userId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .sort({ createdOn: -1 });

        // Transform and validate the data before sending to view
        const processedOrders = orders.map(order => {
            const orderObj = order.toObject();
            
            // Map and validate ordered items
            orderObj.orderedItems = orderObj.orderedItems.map(item => ({
                ...item,
                // Provide fallback values if product is undefined
                product: item.product || {
                    productName: 'Product Unavailable',
                    productImage: []
                },
                // Determine if item can be cancelled
                canCancel: ['Pending', 'Processing'].includes(orderObj.status) && 
                          item.status !== 'Cancelled'
            }));

            return {
                ...orderObj,
                // Format dates
                createdOn: order.createdOn,
                // Format currency values
                totalPrice: order.totalPrice.toFixed(2),
                finalAmount: order.finalAmount.toFixed(2),
                discount: order.discount.toFixed(2)
            };
        });

        res.render('orders', { 
            orders: processedOrders,
            // Add error handling helper
            handleImageError: (imagePath) => imagePath || '/path/to/default/image.jpg'
        });
        
    } catch (error) {
        console.error('Error fetching user orders:', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).render('error', { 
            message: 'Failed to fetch orders',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const cancelOrder = async (req, res) => {
    const { orderId } = req.params;
    
    try {
        const userId = req.user._id;

        // Find order and verify ownership
        const order = await Order.findOne({ 
            orderId: orderId,
            userId: userId 
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Verify cancellation is allowed
        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage'
            });
        }

        // Update product inventory with error handling
        const inventoryUpdates = [];
        for (const item of order.orderedItems) {
            try {
                const updateResult = await Product.findOneAndUpdate(
                    {
                        _id: item.product,
                        'sizeVariants.size': item.size
                    },
                    {
                        $inc: { 'sizeVariants.$.quantity': item.quantity }
                    },
                    { new: true }
                );

                if (!updateResult) {
                    inventoryUpdates.push({
                        success: false,
                        productId: item.product,
                        error: 'Product not found or size variant missing'
                    });
                } else {
                    inventoryUpdates.push({
                        success: true,
                        productId: item.product
                    });
                }
            } catch (error) {
                inventoryUpdates.push({
                    success: false,
                    productId: item.product,
                    error: error.message
                });
            }
        }

      
        const failedUpdates = inventoryUpdates.filter(update => !update.success);
        if (failedUpdates.length > 0) {
            console.error('Some inventory updates failed:', failedUpdates);
        }

        order.status = 'Cancelled';
        order.orderedItems.forEach(item => {
            item.status = 'Cancelled';
        });

        await order.save();

      
        res.setHeader('Content-Type', 'application/json');
        return res.json({
            success: true,
            message: 'Order cancelled successfully',
            inventoryUpdateStatus: failedUpdates.length === 0 ? 'success' : 'partial',
            failedUpdates: failedUpdates.length > 0 ? failedUpdates : undefined
        });

    } catch (error) {
        console.error('Error cancelling order:', {
            error: error.message,
            stack: error.stack,
            orderId: orderId
        });
        
        
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel order',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.user._id;

        // Find and validate order
        const order = await Order.findOne({
            orderId: orderId,
            userId: userId
        }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Find and validate order item
        const orderItem = order.orderedItems.id(itemId);

        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found'
            });
        }

        if (orderItem.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Item is already cancelled'
            });
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be modified at this stage'
            });
        }

        try {
            // Update product inventory
            const productUpdate = await Product.findOneAndUpdate(
                {
                    _id: orderItem.product._id,
                    'sizeVariants.size': orderItem.size
                },
                {
                    $inc: { 'sizeVariants.$.quantity': orderItem.quantity }
                },
                { new: true }
            );

            if (!productUpdate) {
                throw new Error('Failed to update product inventory');
            }

            // Mark item as cancelled and save its original price for reference
            const cancelledItemTotal = orderItem.price * orderItem.quantity;
            orderItem.status = 'Cancelled';
            
            console.log('Before recalculation:', {
                totalPrice: order.totalPrice,
                itemPrice: orderItem.price,
                itemQuantity: orderItem.quantity
            });
            
            order.recalculateTotals();
            
            console.log('After recalculation:', {
                totalPrice: order.totalPrice,
                finalAmount: order.finalAmount
            });
            
            // Save the updated order
            await order.save();

            // Prepare response data
            const activeItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
            const isFullyCancelled = activeItems.length === 0;

            return res.json({
                success: true,
                message: isFullyCancelled ? 'Order has been fully cancelled' : 'Item cancelled successfully',
                updatedOrder: {
                    orderId: order.orderId,
                    status: order.status,
                    totalPrice: order.totalPrice.toFixed(2),
                    finalAmount: order.finalAmount.toFixed(2),
                    itemId: itemId,
                    itemStatus: 'Cancelled',
                    activeItemsCount: activeItems.length,
                    isFullyCancelled: isFullyCancelled,
                    cancelledAmount: cancelledItemTotal.toFixed(2)
                }
            });

        } catch (error) {
            throw new Error(`Failed to process cancellation: ${error.message}`);
        }

    } catch (error) {
        console.error('Error cancelling item:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel item'
        });
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        const order = await Order.findOne({
            orderId: orderId,
            userId: userId
        }).populate([
            {
                path: 'orderedItems.product',
                select: 'productName productImage price',
                model: 'Product'
            }
        ]);

        if (!order) {
            throw new Error('Order not found');
        }

       
        let addressDocument = null;
        
       
        addressDocument = await Address.findById(order.address);
        
       
        if (!addressDocument) {
            addressDocument = await Address.findOne({
                userId: order.userId,
                'address._id': order.address
            });
        }

     
        let addressInfo;
        if (addressDocument) {
     
            const addressData = addressDocument.address.find(
                addr => addr._id.toString() === order.address.toString()
            ) || addressDocument.address[0];

            addressInfo = {
                name: addressData.name || 'N/A',
                street: addressData.landmark || addressData.street || 'N/A',
                city: addressData.city || 'N/A',
                state: addressData.state || 'N/A',
                pincode: addressData.pincode || 'N/A',
                mobile: addressData.phone || addressData.mobile || addressData.altPhone || 'N/A'
            };
        } else {
            addressInfo = {
                name: 'N/A',
                street: 'N/A',
                city: 'N/A',
                state: 'N/A',
                pincode: 'N/A',
                mobile: 'N/A'
            };
        }

        const processedItems = order.orderedItems.map(item => ({
            _id: item._id,
            product: item.product ? {
                _id: item.product._id,
                productName: item.product.productName || 'Product Unavailable',
                productImage: item.product.productImage || []
            } : null,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            status: item.status || order.status,
            canCancel: ['Pending', 'Processing'].includes(order.status) &&
                (!item.status || item.status !== 'Cancelled')
        }));

        const processedOrder = {
            _id: order._id,
            orderId: order.orderId,
            userId: order.userId,
            address: addressInfo,
            orderedItems: processedItems,
            totalPrice: order.totalPrice,
            discount: order.discount || 0,
            finalAmount: order.finalAmount,
            status: order.status,
            createdOn: order.createdOn,
            invoiceDate: order.invoiceDate,
            canCancel: ['Pending', 'Processing'].includes(order.status)
        };

        if (req.xhr && req.accepts('json')) {
            return res.json({
                success: true,
                order: processedOrder
            });
        }

        return res.render('order-details', {
            order: processedOrder,
            user: req.user
        });

    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        if (req.xhr) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch order details'
            });
        }
        return res.status(500).render('error', {
            message: 'Failed to fetch order details'
        });
    }
};
module.exports = {

    createOrder,
    getUserOrders,
    cancelOrder,
    cancelOrderItem,
    getOrderDetails
}