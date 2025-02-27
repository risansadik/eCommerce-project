const Coupon = require('../../models/couponSchema');

const getCoupon = async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        
        // Count total documents for pagination
        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);
        
        // Fetch paginated coupons
        const coupons = await Coupon.find()
                                    .sort({ createdAt: -1 })
                                    .skip(skip)
                                    .limit(limit);
        
        const successMessage = req.session.successMessage;
        const errorMessage = req.session.errorMessage;
        
        delete req.session.successMessage;
        delete req.session.errorMessage;
        
        res.render('coupons', {
            coupons,
            successMessage: successMessage || null,
            errorMessage: errorMessage || null,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.redirect('/admin/dashboard');
    }
};

const addCoupon = async (req, res) => {
    try {
        res.render('add-coupons');
    } catch (error) {
        console.error('Error rendering add coupon page:', error);
        res.redirect('/admin/coupons');
    }
};

const createCoupon = async (req, res) => {
    try {
        const {
            code,
            description,
            discountPercentage,
            offerPrice,
            minimumPurchase,
            maximumPurchase,
            expireOn
        } = req.body;
        
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.redirect('/admin/addCoupons');
        }
        
        const coupon = new Coupon({
            code: code.toUpperCase(),
            description,
            discountPercentage: discountPercentage || undefined,
            offerPrice: offerPrice || undefined,
            minimumPurchase,
            maximumPurchase,
            expireOn: new Date(expireOn),
            status: 'active',
            isList: true
        });
        
        await coupon.save();
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.redirect('/admin/addCoupons');
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.redirect('/admin/coupons');
        }
        
        await Coupon.findByIdAndDelete(id);
        
        req.session.successMessage = 'Coupon deleted successfully!';
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error deleting coupon:', error);
        req.session.errorMessage = 'Error deleting coupon';
        res.redirect('/admin/coupons');
    }
};

module.exports = {
    getCoupon,
    addCoupon,
    createCoupon,
    deleteCoupon
};