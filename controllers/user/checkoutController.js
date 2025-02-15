const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Coupon = require('../../models/couponSchema');
const Wallet = require('../../models/walletSchema')
const { createOrder, verifyPayment } = require('../../config/razorpay');

const checkoutController = {
    getCheckout : async (req, res) => {
        try {
            const userId = req.user._id;
            const cart = await Cart.findOne({ userId })
                .populate('items.productId');
    
            if (!cart || cart.items.length === 0) {
                return res.redirect('/cart');
            }
    
            let updatedItems = [];
            let cartTotal = 0;
            let hasInvalidItems = false;
            let errorHtml = '';
    
         
            for (const item of cart.items) {
                const product = await Product.findById(item.productId._id);
                
                if (!product) {
                    errorHtml += `• ${item.productId.productName} is no longer available<br>`;
                    hasInvalidItems = true;
                    continue;
                }
    
                if (product.isBlocked) {
                    errorHtml += `• ${item.productId.productName} is temporarily unavailable<br>`;
                    hasInvalidItems = true;
                    continue;
                }
    
                if (product.status !== 'Available') {
                    errorHtml += `• ${item.productId.productName} is currently ${product.status.toLowerCase()}<br>`;
                    hasInvalidItems = true;
                    continue;
                }
    
                const sizeVariant = product.sizeVariants.find(v => v.size === item.size);
                if (!sizeVariant) {
                    errorHtml += `• Size ${item.size} not available for ${item.productId.productName}<br>`;
                    hasInvalidItems = true;
                    continue;
                }
    
                if (sizeVariant.quantity < item.quantity) {
                    errorHtml += sizeVariant.quantity === 0 
                        ? `• ${item.productId.productName} (${item.size}) is out of stock<br>`
                        : `• Only ${sizeVariant.quantity} units left for ${item.productId.productName} (${item.size})<br>`;
                    hasInvalidItems = true;
                    continue;
                }
    
                updatedItems.push(item);
                cartTotal += item.totalPrice;
            }
    
          
            if (hasInvalidItems) {
                cart.items = updatedItems;
                await cart.save();
    
                if (updatedItems.length === 0) {
                    return res.redirect('/cart?showAlert=true&message=' + encodeURIComponent(errorHtml));
                }
    
                
                res.locals.showAlert = true;
                res.locals.alertMessage = errorHtml;
            }

            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({
                    userId,
                    balance: 0,
                    transactions: []
                });
                await wallet.save();
            }

            const coupons = await Coupon.find({
                status: 'active',
                expireOn: { $gt: new Date() },
                isList: true
            });

            const availableCoupons = coupons.map(coupon => ({
                code: coupon.code,
                minimumPurchase: coupon.minimumPurchase,
                maximumPurchase: coupon.maximumPurchase,
                discountPercentage: coupon.discountPercentage,
                offerPrice: coupon.offerPrice,
                isEligible: cartTotal >= coupon.minimumPurchase &&
                    cartTotal <= coupon.maximumPurchase &&
                    !coupon.userId.includes(userId),
                isUsed: coupon.userId.includes(userId)
            }));

            const userAddresses = await Address.findOne({ userId });
            let finalAmount = cartTotal;

            if (cart.appliedCoupon?.couponId) {
                const coupon = await Coupon.findById(cart.appliedCoupon.couponId);
                if (coupon) {
                    let discount = 0;
                    if (coupon.discountPercentage) {
                        discount = (cartTotal * coupon.discountPercentage) / 100;
                    } else if (coupon.offerPrice) {
                        discount = Math.min(coupon.offerPrice, cartTotal);
                    }
                    finalAmount = cartTotal - discount;
                    cart.appliedCoupon.discount = discount;
                    await cart.save();
                }
            }

            res.render('checkout', {
                cart,
                cartTotal,
                finalAmount: Math.max(0, cartTotal - (cart.appliedCoupon?.discount || 0)),
                appliedCoupon: cart.appliedCoupon,
                addresses: userAddresses ? userAddresses.address : [],
                user: req.user,
                coupons: availableCoupons,
                walletBalance: wallet.balance,
                showAlert: res.locals.showAlert,
                alertMessage: res.locals.alertMessage
            });
    
        } catch (error) {
            console.error('Checkout error:', error);
            res.status(500).render('error', { message: 'Error loading checkout page' });
        }
    },
    processCheckout: async (req, res) => {
        try {
            const userId = req.user._id;
            const { addressId, paymentMethod } = req.body;



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

            const cart = await Cart.findOne({ userId })
                .populate('items.productId');

            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Your cart is empty'
                });
            }

            // Validate stock
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

            const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            const discount = cart.appliedCoupon?.discount || 0;
            const finalAmount = subtotal - discount;

            const orderData = {
                orderedItems: cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: item.totalPrice,
                    size: item.size
                })),
                totalPrice: subtotal,
                discount: cart.appliedCoupon?.discount || 0,
                finalAmount: finalAmount,
                couponApplied: cart.appliedCoupon ? {
                    couponId: cart.appliedCoupon.couponId,
                    discountAmount: cart.appliedCoupon.discount,
                    couponCode: cart.appliedCoupon.code
                } : {
                    couponId: null,
                    discountAmount: 0,
                    couponCode: null
                },
                address: addressId,
                status: 'Pending',
                paymentMethod: paymentMethod,
                userId: userId
            };

            let order;


            if (paymentMethod === 'wallet') {
                const wallet = await Wallet.findOne({ userId });
                if (!wallet || wallet.balance < finalAmount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient wallet balance'
                    });
                }

                orderData.paymentStatus = 'completed';
                order = new Order(orderData);
                await order.save();


                await wallet.useForPurchase(finalAmount, order._id);

                // Update user's wallet balance
                await User.findByIdAndUpdate(userId, {
                    $inc: { wallet: -finalAmount }
                });
            }

            else {
                if (paymentMethod === 'cod') {
                    orderData.paymentStatus = 'pending';
                }
                order = new Order(orderData);
                await order.save();
            }


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


            await User.findByIdAndUpdate(userId, {
                $push: { orderHistory: order._id }
            });


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
    },
    createRazorpayOrder: async (req, res) => {
        try {
            const userId = req.user._id;
            const { addressId } = req.body;
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

            const cart = await Cart.findOne({ userId })
                .populate('items.productId');

            const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            const finalAmount = subtotal - (cart.appliedCoupon?.discount || 0);

           
            const razorpayOrder = await createOrder(finalAmount, userId.toString());

            const orderData = {
                orderedItems: cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: item.totalPrice,
                    size: item.size
                })),
                totalPrice: subtotal,
                discount: cart.appliedCoupon?.discount || 0,
                finalAmount: finalAmount,
                couponApplied: cart.appliedCoupon ? {
                    couponId: cart.appliedCoupon.couponId,
                    discountAmount: cart.appliedCoupon.discount,
                    couponCode: cart.appliedCoupon.code
                } : {
                    couponId: null,
                    discountAmount: 0,
                    couponCode: null
                },
                address: addressId,
                status: 'Pending',
                paymentMethod: 'razorpay',
                paymentStatus: 'pending',
                razorpayOrderId: razorpayOrder.id,
                userId: userId
            };

            const order = new Order(orderData);
            await order.save();

            res.json({
                success: true,
                order: {
                    id: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency
                },
                key: process.env.RAZORPAY_KEY_ID
            });

        } catch (error) {
            console.error('Razorpay order creation error:', error);
            res.status(500).json({
                success: false,
                message: 'Payment initialization failed'
            });
        }
    },

    verifyPayment: async (req, res) => {
        try {
            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            } = req.body;

            const userId = req.user._id;

            if (!verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
                return res.status(400).json({
                    success: false,
                    message: 'Payment verification failed'
                });
            }

            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            const cart = await Cart.findOne({ userId })
                .populate('items.productId');

            if (!cart) {
                return res.status(404).json({
                    success: false,
                    message: 'Cart not found'
                });
            }

            order.paymentStatus = 'completed';
            order.razorpayPaymentId = razorpay_payment_id;
            order.status = 'Processing';
            await order.save();

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

            await User.findByIdAndUpdate(userId, {
                $push: { orderHistory: order._id }
            });

            await Cart.findByIdAndDelete(cart._id);

            res.json({
                success: true,
                message: 'Payment verified successfully',
                orderId: order.orderId
            });

        } catch (error) {
            console.error('Payment verification error:', error);
            res.status(500).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
    }
};

module.exports = checkoutController;