const Cart = require('../../models/cartSchema');
const Coupon = require('../../models/couponSchema');

const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.user._id;
        
        const coupon = await Coupon.findOne({
            code: { $regex: new RegExp(`^${couponCode}$`, 'i') },
            status: 'active',
            expireOn: { $gt: new Date() },
            isList: true
        });
        
        if (!coupon) {
            return res.json({
                success: false,
                message: 'Invalid or expired coupon code' 
            });
        }

        if (coupon.userId.includes(userId)) {
            return res.json({
                success: false,
                message: 'You have already used this coupon'
            });
        }


        const cart = await Cart.findOne({ userId });
        const cartTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

     
        if (cartTotal < coupon.minimumPurchase) {
            return res.json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPurchase} required. Current total: ₹${cartTotal}`
            });
        }

    
        if (cartTotal > coupon.maximumPurchase) {
            return res.json({
                success: false,
                message: `This coupon is valid only for purchases up to ₹${coupon.maximumPurchase}. Current total: ₹${cartTotal}`
            });
        }

        let discount = 0;
        if (coupon.discountPercentage) {
            discount = (cartTotal * coupon.discountPercentage) / 100;
        } else if (coupon.offerPrice) {
            discount = Math.min(coupon.offerPrice, cartTotal);
        }

        cart.appliedCoupon = {
            couponId: coupon._id,
            discount: discount
        };
        await cart.save();

        coupon.userId.push(userId);
        await coupon.save();

        res.json({
            success: true,
            message: `Coupon applied successfully! Saved ₹${discount}`,
            data: {
                cartTotal,
                discount,
                finalTotal: cartTotal - discount
            }
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying coupon'
        });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await Cart.findOne({ userId });

        if (!cart.appliedCoupon.couponId) {
            return res.json({
                success: false,
                message: 'No coupon applied to remove'
            });
        }

    
        await Coupon.findByIdAndUpdate(
            cart.appliedCoupon.couponId,
            { $pull: { userId: userId } }
        );

       
        cart.appliedCoupon = {
            couponId: null,
            discount: 0
        };
        await cart.save();

      
        const cartTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        
        res.json({
            success: true,
            message: 'Coupon removed successfully',
            data: {
                finalTotal: cartTotal
            }
        });
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing coupon'
        });
    }
};

const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const cart = await Cart.findOne({ userId });
        const cartTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

     
        const coupons = await Coupon.find({
            status: 'active',
            expireOn: { $gt: new Date() },
            isList: true
        });

      
        const allCoupons = coupons.map(coupon => {
            const isWithinRange = cartTotal >= coupon.minimumPurchase && cartTotal <= coupon.maximumPurchase;
            const notUsedByUser = !coupon.userId.includes(userId);

            let reason = '';
            if (!isWithinRange) {
                if (cartTotal < coupon.minimumPurchase) {
                    reason = `Minimum purchase of ₹${coupon.minimumPurchase} required`;
                } else {
                    reason = `Valid only for purchases up to ₹${coupon.maximumPurchase}`;
                }
            }
            else if (!notUsedByUser) reason = 'You have already used this coupon';

            return {
                code: coupon.code,
                minimumPurchase: coupon.minimumPurchase,
                maximumPurchase: coupon.maximumPurchase,
                discountPercentage: coupon.discountPercentage,
                offerPrice: coupon.offerPrice,
                isEligible: isWithinRange &&  notUsedByUser,
                reason: reason,
                cartTotal: cartTotal
            };
        });

        res.json(allCoupons);
    } catch (error) {
        console.error('Error in getAvailableCoupons:', error);
        res.status(500).json({ error: 'Error fetching coupons' });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon,
    getAvailableCoupons
};