const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
});

const createOrder = async (amount, receipt) => {
    try {
        const options = {
            amount: amount * 100, 
            currency: 'INR',
            receipt,
            payment_capture: 1
        };
        return await razorpay.orders.create(options);
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        throw error;
    }
};

const verifyPayment = (razorpayOrderId, razorpayPaymentId, signature) => {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET);
    hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const generated_signature = hmac.digest('hex');
    return generated_signature === signature;
};

module.exports = { createOrder, verifyPayment };