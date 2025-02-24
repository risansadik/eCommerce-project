const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const ReturnOrder = require('../../models/returnOrderSchema');
const Wallet = require('../../models/walletSchema')



const createOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId, paymentMethod } = req.body;


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
            .populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }


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


        let finalAmount = totalPrice;
        let couponDetails = {
            couponCode: null,
            couponId: null,
            discountAmount: 0
        };


        if (cart.appliedCoupon && cart.appliedCoupon.couponId) {
            const coupon = await Coupon.findById(cart.appliedCoupon.couponId);
            if (coupon) {
                couponDetails = {
                    couponCode: coupon.code,
                    couponId: cart.appliedCoupon.couponId,
                    discountAmount: cart.appliedCoupon.discount
                };
                finalAmount = totalPrice - cart.appliedCoupon.discount;
            }
        }

        const order = new Order({
            userId: userId,
            orderedItems: orderItems,
            totalPrice,
            discount: couponDetails.discountAmount,
            finalAmount,
            address: addressDocument._id,
            status: 'Pending',
            invoiceDate: new Date(),
            couponApplied: couponDetails
        });


        await order.save();


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
        
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const ordersPerPage = 5; // Number of orders per page
        
        // Query to get total count for pagination
        const totalOrders = await Order.countDocuments({
            userId,
            $or: [
                {
                    paymentMethod: { $in: ['razorpay', 'wallet'] },
                    paymentStatus: 'completed'
                },
                {
                    paymentMethod: 'cod'
                }
            ]
        });
        
        // Calculate pagination values
        const totalPages = Math.ceil(totalOrders / ordersPerPage);
        const skip = (page - 1) * ordersPerPage;
        
        // Get paginated orders
        const orders = await Order.find({
            userId,
            $or: [
                {
                    paymentMethod: { $in: ['razorpay', 'wallet'] },
                    paymentStatus: 'completed'
                },
                {
                    paymentMethod: 'cod'
                }
            ]
        })
        .populate({
            path: 'orderedItems.product',
            select: 'productName productImage'
        })
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(ordersPerPage);
        
        const processedOrders = orders.map(order => {
            const orderObj = order.toObject();
            
            orderObj.orderedItems = orderObj.orderedItems.map(item => ({
                ...item,
                product: item.product || {
                    productName: 'Product Unavailable',
                    productImage: []
                },
                canCancel: ['Pending', 'Processing'].includes(orderObj.status) &&
                    item.status !== 'Cancelled'
            }));
            
            return {
                ...orderObj,
                createdOn: order.createdOn,
                totalPrice: order.totalPrice.toFixed(2),
                finalAmount: order.finalAmount.toFixed(2),
                discount: order.discount.toFixed(2)
            };
        });
        
        res.render('orders', {
            orders: processedOrders,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1
            },
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
    const { reason } = req.body;

    try {
        const userId = req.user._id;

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

        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled at this stage'
            });
        }


        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelledAt = new Date();


        order.orderedItems.forEach(item => {
            item.status = 'Cancelled';
            item.cancellationReason = reason;
            item.cancelledAt = new Date();
        });

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

        if (['razorpay', 'wallet'].includes(order.paymentMethod) && order.paymentStatus === 'completed') {
            try {
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    wallet = new Wallet({
                        userId,
                        balance: 0,
                        transactions: []
                    });
                }


                await wallet.addRefund(order.finalAmount, order._id);
                order.paymentStatus = 'refunded';
            } catch (error) {
                console.error('Refund failed:', error);
            }
        }
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
        const { reason } = req.body;
        const userId = req.user._id;

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

        const orderItem = order.orderedItems.id(itemId);
        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found'
            });
        }

      
        orderItem.status = 'Cancelled';
        orderItem.cancellationReason = reason;
        orderItem.cancelledAt = new Date();

      
        try {
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

            const remainingActiveItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
            const remainingTotal = remainingActiveItems.reduce((sum, item) => 
                sum + (item.price * item.quantity), 0);

            const originalDiscount = order.discount;
            const cancelledItemTotal = orderItem.price * orderItem.quantity;
            
            order.totalPrice = remainingTotal;
            let refundAmount = cancelledItemTotal;

          
            if (order.couponApplied && order.couponApplied.couponId) {
                const coupon = await Coupon.findById(order.couponApplied.couponId);
                if (coupon) {
                  
                    if (remainingTotal < coupon.minimumPurchase) {
                        
                        order.couponApplied = {
                            couponCode: null,
                            couponId: null,
                            discountAmount: 0
                        };
                       
                        refundAmount = cancelledItemTotal - originalDiscount;
                        order.discount = 0;
                        
                       
                        await Coupon.findByIdAndUpdate(
                            coupon._id,
                            { $pull: { userId: userId } }
                        );
                    } else {
                        
                        let newDiscountAmount = 0;
                        if (coupon.discountPercentage) {
                            newDiscountAmount = (remainingTotal * coupon.discountPercentage) / 100;
                        } else if (coupon.offerPrice) {
                            newDiscountAmount = coupon.offerPrice;
                        }
                        if (coupon.maxDiscount && newDiscountAmount > coupon.maxDiscount) {
                            newDiscountAmount = coupon.maxDiscount;
                        }
                        order.discount = newDiscountAmount;
                        
                        refundAmount = cancelledItemTotal - originalDiscount;
                    }
                }
            }

            order.finalAmount = order.totalPrice - order.discount;
            

           
            if (['razorpay', 'wallet'].includes(order.paymentMethod) && order.paymentStatus === 'completed') {
                try {
                    let wallet = await Wallet.findOne({ userId });
                    if (!wallet) {
                        wallet = new Wallet({
                            userId,
                            balance: 0,
                            transactions: []
                        });
                    }
                  
                    if (refundAmount > 0) {
                        await wallet.addRefund(refundAmount, order._id);
                        orderItem.paymentStatus = 'refunded';
                    }
                } catch (error) {
                    console.error('Refund failed:', error);
                }
            }

            
            if (remainingActiveItems.length === 0) {
                order.status = 'Cancelled';
                order.cancellationReason = 'All items cancelled';
                order.cancelledAt = new Date();
            }

            await order.save();

            return res.json({
                success: true,
                message: remainingActiveItems.length === 0 ? 'Order has been fully cancelled' : 'Item cancelled successfully',
                updatedOrder: {
                    orderId: order.orderId,
                    status: order.status,
                    totalPrice: order.totalPrice.toFixed(2),
                    finalAmount: order.finalAmount.toFixed(2),
                    discount: order.discount.toFixed(2),
                    itemId: itemId,
                    itemStatus: 'Cancelled',
                    activeItemsCount: remainingActiveItems.length,
                    isFullyCancelled: remainingActiveItems.length === 0,
                    couponRemoved: !order.couponApplied.couponId,
                    refundAmount: refundAmount.toFixed(2),
                    refundStatus: orderItem.paymentStatus,
                    cancellationReason: orderItem.cancellationReason,
                    cancelledAt: orderItem.cancelledAt
                }
            });

        } catch (error) {
            throw new Error(`Failed to process cancellation: ${error.message}`);
        }

    } catch (error) {
        console.error('Error cancelling item:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel item',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

        const canDownloadInvoice = (
            (order.paymentMethod === 'cod' && order.status === 'Delivered') ||
            (order.paymentMethod !== 'cod' && ['Shipped', 'Delivered'].includes(order.status))
        );


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
            canCancel: ['Pending', 'Processing'].includes(order.status),
            paymentMethod: order.paymentMethod,
            paymentStatus: order.status === 'Delivered' ? 'completed' : order.paymentStatus,
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: order.razorpayPaymentId,
            invoiceNumber: order.invoiceNumber,
            invoiceGeneratedAt: order.invoiceGeneratedAt,
            canDownloadInvoice,
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

const getReturnRequests = async (req, res) => {
    try {
        const userId = req.user._id;

        const returnRequests = await ReturnOrder.find({ userId })
            .populate('orderId')
            .sort({ requestDate: -1 });

        return res.json({
            success: true,
            returnRequests
        });

    } catch (error) {
        console.error('Error fetching return requests:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch return requests'
        });
    }
};

const submitReturnRequest = async (req, res) => {
    try {
        const { orderId, returnReason } = req.body;
        const userId = req.user._id;



        const order = await Order.findOne({ orderId: orderId, userId });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({
                success: false,
                message: 'Order is not eligible for return'
            });
        }


        const returnOrder = new ReturnOrder({
            orderId: order._id,
            userId,
            returnReason,
            refundAmount: order.finalAmount
        });

        await returnOrder.save();


        order.status = 'Return Request';
        await order.save();

        return res.json({
            success: true,
            message: 'Return request submitted successfully',
            returnOrder
        });

    } catch (error) {
        console.error('Error submitting return request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit return request'
        });
    }
};

const processReturnRequest = async (req, res) => {
    try {
        const { returnId, action } = req.body;

        const returnOrder = await ReturnOrder.findById(returnId).populate('orderId');
        if (!returnOrder) {
            return res.status(404).json({
                success: false,
                message: 'Return request not found'
            });
        }

        const order = returnOrder.orderId;

        if (action === 'approve') {

            returnOrder.returnStatus = 'Approved';
            returnOrder.processedDate = new Date();


            order.status = 'Returned';
            if (['razorpay', 'wallet'].includes(order.paymentMethod) && order.paymentStatus === 'completed') {
                try {
                    let wallet = await Wallet.findOne({ userId: order.userId });
                    if (!wallet) {
                        wallet = new Wallet({
                            userId: order.userId,
                            balance: 0,
                            transactions: []
                        });
                    }


                    await wallet.addRefund(order.finalAmount, order._id);

                    returnOrder.refundStatus = 'Processed';
                    returnOrder.refundAmount = order.finalAmount;
                    order.paymentStatus = 'refunded';
                } catch (error) {
                    console.error('Return refund failed:', error);
                    returnOrder.refundStatus = 'Failed';
                }
            }

            await order.save();
            await returnOrder.save();
        }

        return res.json({
            success: true,
            message: `Return request ${action === 'approve' ? 'approved' : 'rejected'}`,
            returnOrder
        });

    } catch (error) {
        console.error('Error processing return request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process return request'
        });
    }
};

const generateInvoicePDF = async (req, res) => {
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
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const activeItems = order.orderedItems.filter(item => item.status !== 'Cancelled');

        const totalPrice = activeItems.reduce((sum, item) => sum + item.price, 0);
        const finalAmount = totalPrice - (order.discount || 0);



        let addressDocument = await Address.findById(order.address);

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

        const canDownloadInvoice = (
            (order.paymentMethod === 'cod' && order.status === 'Delivered') ||
            (order.paymentMethod !== 'cod' && ['Shipped', 'Delivered'].includes(order.status))
        );

        if (!canDownloadInvoice) {
            return res.status(403).json({ success: false, message: 'Invoice not available yet' });
        }


        return res.json({
            success: true,
            order: {
                orderId: order.orderId,
                invoiceNumber: order.invoiceNumber || `INV-${order.orderId}`,
                invoiceGeneratedAt: order.invoiceGeneratedAt || new Date(),
                orderedItems: activeItems,
                totalPrice: totalPrice,
                discount: order.discount || 0,
                finalAmount: finalAmount,
                address: addressInfo,
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.status === 'Delivered' ? 'completed' : order.paymentStatus,
                orderDate: order.createdOn,
                razorpayPaymentId: order.razorpayPaymentId
            }
        });
    } catch (error) {
        console.error('Error in generateInvoicePDF:', error);
        res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
};


module.exports = {

    createOrder,
    getUserOrders,
    cancelOrder,
    cancelOrderItem,
    getOrderDetails,
    getReturnRequests,
    processReturnRequest,
    submitReturnRequest,
    generateInvoicePDF
}