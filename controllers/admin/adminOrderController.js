const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const ReturnOrder = require('../../models/returnOrderSchema');
const Wallet = require('../../models/walletSchema');

const getAllOrders = async (req, res) => {
    try {
       
        const orders = await Order.find({})
            .populate('orderedItems.product', 'productName')
            .populate('userId', 'name email phone')
            .sort({ createdOn: -1 });

      
        const returnRequests = await ReturnOrder.find({})
            .populate({
                path: 'orderId',
                select: 'orderId' 
            })
            .populate('userId', 'name')
            .sort({ requestDate: -1 });
        const processedOrders = await Promise.all(orders.map(async (order) => {
            try {
           
                let addressDocument = null;

                
                addressDocument = await Address.findById(order.address);

    
                if (!addressDocument) {
                    addressDocument = await Address.findOne({ 
                        userId: order.userId,
                        'address._id': order.address 
                    });
                }

                

               
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
            returnRequests, 
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
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

    
        if (status === 'Return Request') {
            return res.status(400).json({
                success: false,
                message: 'Return requests can only be initiated by customers'
            });
        }

        
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
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

      
        if (order.isReturnProcessed && order.status === 'Returned') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update status of returned order'
            });
        }

     
        if (order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update status of cancelled order'
            });
        }


        order.status = status;
        await order.save();

        return res.json({
            success: true,
            message: 'Order status updated successfully',
            newStatus: status
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
};

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

      
        if (['Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel order at this stage'
            });
        }

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

const submitReturnRequest = async (req, res) => {
    try {
        const { orderId, returnReason } = req.body;
        const userId = req.user._id;  

     
        const order = await Order.findOne({ orderId: orderId });
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
            userId: userId,    
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
            await order.save();

           

            
            if (order.paymentMethod === 'razorpay' && order.paymentStatus === 'completed') {
            
                returnOrder.refundStatus = 'Processed';
            }

        } else if (action === 'reject') {
            returnOrder.returnStatus = 'Rejected';
            returnOrder.processedDate = new Date();

          
            order.status = 'Delivered';
            await order.save();
        }

        await returnOrder.save();

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

const getReturnRequests = async (req, res) => {
    try {
        const returnRequests = await ReturnOrder.find({})
            .populate('orderId')
            .populate('userId', 'name email')
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

const approveReturnRequest = async (req, res) => {
    try {
        const { returnId } = req.params;

        const returnRequest = await ReturnOrder.findById(returnId)
            .populate({
                path: 'orderId',
                model: 'Order',
                select: 'status orderId paymentMethod paymentStatus userId finalAmount'
            })
            .populate('userId');

        if (!returnRequest) {
            return res.status(404).json({
                success: false,
                message: 'Return request not found'
            });
        }

        
        returnRequest.returnStatus = 'Approved';
        returnRequest.processedDate = new Date();
        
       
        const order = await Order.findById(returnRequest.orderId._id);
        if (!order) {
            throw new Error('Associated order not found');
        }

        order.status = 'Returned';
        order.isReturnProcessed = true;

        
        let wallet = await Wallet.findOne({ userId: order.userId });
        
  
        if (!wallet) {
            wallet = new Wallet({
                userId: order.userId,
                balance: 0,
                transactions: []
            });
        }


        const refundAmount = order.finalAmount;
        await wallet.addRefund(refundAmount, order._id);

    
        returnRequest.refundStatus = 'Processed';
        returnRequest.refundAmount = refundAmount;
        returnRequest.refundDate = new Date();

   
        await returnRequest.save();
        await order.save();
        await wallet.save();

        return res.json({
            success: true,
            message: 'Return request approved and refund processed successfully',
            returnRequest,
            orderStatus: order.status,
            refundAmount: refundAmount,
            walletBalance: wallet.balance
        });

    } catch (error) {
        console.error('Error approving return request:', {
            error: error.message,
            stack: error.stack,
            returnId: returnId
        });
        
        return res.status(500).json({
            success: false,
            message: 'Failed to approve return request',
            error: error.message
        });
    }
};
const rejectReturnRequest = async (req, res) => {
    try {
        const { returnId } = req.params;

        const returnRequest = await ReturnOrder.findById(returnId).populate('orderId');
        if (!returnRequest) {
            return res.status(404).json({
                success: false,
                message: 'Return request not found'
            });
        }

        returnRequest.returnStatus = 'Rejected';
        returnRequest.processedDate = new Date();
        await returnRequest.save();

       
        const order = returnRequest.orderId;
        order.status = 'Delivered';
        await order.save();

        return res.json({
            success: true,
            message: 'Return request rejected successfully',
            returnRequest
        });

    } catch (error) {
        console.error('Error rejecting return request:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reject return request'
        });
    }
};



module.exports = {
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
    getReturnRequests,
    processReturnRequest,
    submitReturnRequest,
    approveReturnRequest, 
    rejectReturnRequest
};