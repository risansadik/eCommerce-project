const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const ReturnOrder = require('../../models/returnOrderSchema');

const walletController = {
    getWallet: async (req, res) => {
        try {
            if (!req.user || !req.user._id) {
                return res.status(401).redirect('/login');
            }
            
            const userId = req.user._id;
            
          
            let wallet = await Wallet.findOne({ userId })
                .populate({
                    path: 'transactions.orderId',
                    select: 'orderId finalAmount'
                });

            if (!wallet) {
                wallet = new Wallet({
                    userId,
                    balance: 0,
                    transactions: []
                });
                await wallet.save();
            }

          
            const formattedWallet = {
                balance: Number(wallet.balance || 0), 
                transactions: wallet.transactions.map(transaction => ({
                    type: transaction.type,
                    amount: Number(transaction.amount || 0),
                    description: transaction.description,
                    createdAt: transaction.createdAt,
                    orderId: transaction.orderId?._id || null,
                    orderNumber: transaction.orderId?.orderId || 'N/A',
                    transactionType: transaction.transactionType
                }))
            };

            res.render('wallet', { 
                wallet: formattedWallet,
                user: req.user
            });

        } catch (error) {
            console.error('Error fetching wallet:', error);
           
            res.render('wallet', {
                wallet: {
                    balance: 0,
                    transactions: []
                },
                error: 'Unable to fetch wallet details'
            });
        }
    },

   
    processReturnRefund: async (req, res) => {
        try {
            const { returnOrderId } = req.body;
            if (!req.user || !req.user._id) {
                throw new Error('User not authenticated');
            }
            const userId = req.user._id;

           
            const returnOrder = await ReturnOrder.findById(returnOrderId)
                .populate({
                    path: 'orderId',
                    select: 'paymentMethod paymentStatus finalAmount'
                });
            
            if (!returnOrder || returnOrder.userId.toString() !== userId.toString()) {
                throw new Error('Invalid return order');
            }

            if (returnOrder.refundStatus !== 'Pending') {
                throw new Error('Refund already processed');
            }

          
            if (returnOrder.orderId.paymentMethod !== 'razorpay' || 
                returnOrder.orderId.paymentStatus !== 'completed') {
                throw new Error('Only Razorpay payments are eligible for wallet refunds');
            }

           
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ 
                    userId,
                    balance: 0
                });
            }

            
            const refundAmount = returnOrder.orderId.finalAmount;
            await wallet.addRefund(refundAmount, returnOrder.orderId._id);

          
            returnOrder.refundStatus = 'Processed';
            returnOrder.processedDate = new Date();
            await returnOrder.save();

            res.json({ 
                success: true, 
                balance: wallet.balance.toFixed(2),
                message: 'Refund processed successfully'
            });

        } catch (error) {
            console.error('Error processing refund:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    },


    useWalletForOrder: async (req, res) => {
        try {
            const { orderId, amount } = req.body;
            if (!req.user || !req.user._id) {
                throw new Error('User not authenticated');
            }
            const userId = req.user._id;

          
            const paymentAmount = parseFloat(amount);
            if (isNaN(paymentAmount) || paymentAmount <= 0) {
                throw new Error('Invalid payment amount');
            }

     
            const order = await Order.findById(orderId);
            if (!order || order.userId.toString() !== userId.toString()) {
                throw new Error('Invalid order');
            }

            if (order.paymentStatus === 'completed') {
                throw new Error('Order already paid');
            }

       
            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            if (wallet.balance < paymentAmount) {
                throw new Error('Insufficient wallet balance');
            }

          
            await wallet.useForPurchase(paymentAmount, orderId);

            
            if (paymentAmount === order.finalAmount) {
                order.paymentStatus = 'completed';
                order.paymentMethod = 'wallet';
                await order.save();
            }

            res.json({ 
                success: true, 
                balance: wallet.balance.toFixed(2),
                message: 'Payment processed successfully'
            });

        } catch (error) {
            console.error('Error using wallet for purchase:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
};

module.exports = walletController;