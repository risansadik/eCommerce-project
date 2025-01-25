const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema')

const checkoutController = {
    getCheckout: async (req, res) => {
        try {
            const userId = req.user._id;

            // Get cart with populated product details
            const cart = await Cart.findOne({ userId })
                .populate('items.productId', 'productName productImage salePrice status isBlocked');

            // Validate cart
            if (!cart || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            // Check product availability and stock
            let hasStockIssue = false;
            let stockMessage = '';

            for (const item of cart.items) {
                if (!item.productId || item.productId.isBlocked || item.productId.status !== 'Available') {
                    hasStockIssue = true;
                    stockMessage = 'Some items in your cart are no longer available';
                    break;
                }

                const product = await Product.findById(item.productId);
                const sizeVariant = product.sizeVariants.find(v => v.size === item.size);
                if (!sizeVariant || sizeVariant.quantity < item.quantity) {
                    hasStockIssue = true;
                    stockMessage = 'Some items in your cart are out of stock';
                    break;
                }
            }

            if (hasStockIssue) {
                return res.redirect('/cart');
            }

            // Get user's addresses
            const userAddresses = await Address.findOne({ userId });

            // Calculate totals
            const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

            res.render('checkout', {
                cart: cart,
                cartTotal,
                addresses: userAddresses ? userAddresses.address : [],
                user: req.user,
                stockMessage
            });

        } catch (error) {
            console.error('Checkout error:', error);
            res.status(500).render('error', { message: 'Error loading checkout page' });
        }
    },

    processCheckout: async (req, res) => {
        try {
            const userId = req.user._id;
            const { addressId } = req.body;

            // Validate address
            const userAddress = await Address.findOne({
                userId,
                'address._id': addressId
            });

            if (!userAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'Please select a valid delivery address'
                });
            }

            // Get and validate cart
            const cart = await Cart.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Your cart is empty'
                });
            }

            // Validate products and stock
            for (const item of cart.items) {
                const product = await Product.findById(item.productId);

                if (!product || product.isBlocked || product.status !== 'Available') {
                    return res.status(400).json({
                        success: false,
                        message: `${item.productId.productName} is no longer available`
                    });
                }

                const sizeVariant = product.sizeVariants.find(v => v.size === item.size);
                if (!sizeVariant || sizeVariant.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `${item.productId.productName} does not have sufficient stock`
                    });
                }
            }

            // Create order using createOrder function
            const orderData = {
                orderedItems: cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: item.totalPrice,
                    size: item.size
                })),
                totalPrice: cart.items.reduce((total, item) => total + item.totalPrice, 0),
                finalAmount: cart.items.reduce((total, item) => total + item.totalPrice, 0),
                address: addressId,
                status: 'Pending',
                paymentMethod: req.body.paymentMethod || 'cod',
                userId: userId
            };

            const order = new Order(orderData);
            await order.save();

            // Update product quantities
            for (const item of cart.items) {
                await Product.updateOne(
                    {
                        _id: item.productId._id,
                        'sizeVariants.size': item.size
                    },
                    {
                        $inc: { 'sizeVariants.$.quantity': -item.quantity }
                    }
                );
            }

            // Add order to user's order history
            await User.findByIdAndUpdate(userId, {
                $push: { orderHistory: order._id }
            });

            // Clear the cart
            await Cart.findByIdAndDelete(cart._id);

            res.status(200).json({
                success: true,
                message: 'Order placed successfully',
                orderId: order.orderId,
                redirect: '/order-success'
            });

        } catch (error) {
            console.error('Checkout processing error:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while processing your order'
            });
        }
    }
};

module.exports = checkoutController;