const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');


const createOrder = async (req, res) => {

    try {
        const userId = req.session.user._id; 
        const { addressId, paymentMethod } = req.body;

        

        // Comprehensive address validation
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
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .session(session);

        if (!cart || cart.items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        let totalPrice = 0;
        let orderItems = [];

        for (const item of cart.items) {
            const product = item.productId;
            
            const sizeVariant = product.sizeVariants.find(v => v.size === item.size);
            if (!sizeVariant || sizeVariant.quantity < item.quantity) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `${product.productName} (${item.size}) is out of stock`
                });
            }

            totalPrice += item.totalPrice;
            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: item.price
            });
        }

        const order = new Order({
            userId: userId,
            orderedItems: orderItems,
            totalPrice,
            finalAmount: totalPrice, 
            address: addressDocument._id,  // Explicitly use address _id
            status: 'Pending',
            invoiceDate: new Date()
        });

        // Use session for consistent transaction
        await order.save({ session });

        // Additional validation after save
        const savedOrder = await Order.findById(order._id)
            .populate('address')
            .session(session);

        console.log("Saved Order Verification:", {
            orderId: savedOrder._id,
            addressPopulated: !!savedOrder.address,
            addressDetails: savedOrder.address
        });

        await session.commitTransaction();
        session.endSession();

        return res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order.orderId
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Comprehensive Order Creation Error:', {
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
        const user = await User.findById(userId)
            .populate({
                path: 'orderHistory',
                populate: {
                    path: 'orderedItems.product',
                    select: 'productName productImage'
                }
            })
            .select('orderHistory');
        
        // Debug logging
        console.log(JSON.stringify(user.orderHistory, null, 2));
        
        res.render('orders', { orders: user.orderHistory });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).render('error', { message: 'Failed to fetch orders' });
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user._id;

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .populate('address');

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        res.render('order-details', { order });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', { message: 'Failed to fetch order details' });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage'
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

    createOrder,
    getUserOrders,
    getOrderDetails,
    cancelOrder
}