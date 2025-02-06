const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require('../controllers/user/profileController');
const addressController = require('../controllers/user/addressController');
const cartController = require('../controllers/user/cartController');
const checkoutController = require('../controllers/user/checkoutController');
const orderController = require('../controllers/user/orderController');
const couponController = require('../controllers/user/couponController');
const wishlistController = require('../controllers/user/wishlistController');
const walletController = require('../controllers/user/walletController');
const referralController = require('../controllers/user/referralController');

const passport = require('passport');
const { blockAuth,userAuth , adminAuth , redirectIfAuthenticated} = require('../middlewares/auth');


router.get('/', blockAuth, userController.loadHomePage);
router.get('/pageNotFound', userController.pageNotFound);
router.get('/signin',redirectIfAuthenticated, userController.loadSignIn);
router.post('/signin',redirectIfAuthenticated, userController.signin);
router.get('/signup',redirectIfAuthenticated, userController.loadSignUp)
router.post('/signup',redirectIfAuthenticated, userController.signup);
router.post('/verify-otp',redirectIfAuthenticated, userController.verifyOtp);
router.post('/resend-otp',redirectIfAuthenticated, userController.resendOtp);
router.get('/logout', userController.logout)
router.get('/shop', blockAuth,userController.getShopPage);
router.get('/productDetails',blockAuth, userController.getProductDetails);


router.get('/auth/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' 
    })
);

router.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/signin',
        failureMessage: true
    }),
    (req, res) => {
       
        req.session.user = req.user._id;
        console.log('Google auth successful, session user set:', req.session.user);
        res.redirect('/');
    }
);

//profile management

router.get('/forgot-password', profileController.getForgotPassPage);
router.post('/forgot-email-valid', profileController.forgotEmailValid);
router.post('/verify-passforgot-otp', profileController.verifyForgotPassOtp);
router.get('/reset-password', profileController.getResetPassPage);
router.post('/resend-forgot-otp', profileController.resendOtp);
router.post('/reset-password', profileController.postNewPassword);
router.get('/userProfile',userAuth, profileController.loadDashboard);
router.get('/edit-userProfile',userAuth, profileController.getUserEditPage);

router.get('/check-session', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        sessionExists: !!req.session,
        user: req.user,
        sessionContent: req.session
    });
});

router.put('/edit-userProfile/:id',userAuth, profileController.editUser);

//address management


router.get('/addAddress',userAuth, addressController.getAddAddressPage);
router.post('/address/add',userAuth, addressController.addAddress);
router.get('/addresses',userAuth, addressController.loadAddresses);
router.delete('/deleteAddress/:index', userAuth, addressController.deleteAddress);
router.get('/editAddress/:index', userAuth, addressController.editAddress);
router.put('/updateAddress', userAuth, addressController.updateAddress);

//cart management

router.post('/addCart', userAuth, cartController.addToCart);
router.get('/cart', userAuth, cartController.getCart);
router.put('/updateCart', userAuth, cartController.updateCartItem);
router.delete('/removeCart/:itemId', userAuth, cartController.removeCartItem);

//checkout management

router.get('/checkout', userAuth, checkoutController.getCheckout);
router.post('/process-checkout', userAuth, checkoutController.processCheckout);
router.post('/create-razorpay-order', userAuth, checkoutController.createRazorpayOrder);
router.post('/verify-payment', userAuth, checkoutController.verifyPayment);



router.get('/orders', userAuth, orderController.getUserOrders);
router.post('/orders/create', userAuth, orderController.createOrder);
router.post('/orders/:orderId/cancel', userAuth, orderController.cancelOrder);
router.post('/orders/:orderId/items/:itemId/cancel',userAuth, orderController.cancelOrderItem);
router.get('/orders/:orderId', userAuth, orderController.getOrderDetails);

router.post('/submit-return',userAuth,orderController.submitReturnRequest);
router.get('/return-requests',userAuth,orderController.getReturnRequests);
router.post('/process-return',userAuth,orderController.processReturnRequest);



router.post('/apply-coupon', userAuth, couponController.applyCoupon);
router.post('/remove-coupon', userAuth, couponController.removeCoupon);
router.get('/available-coupons', userAuth, couponController.getAvailableCoupons);

router.get('/wishlist', userAuth, wishlistController.getWishlist);
router.post('/wishlist/add', userAuth, wishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId', userAuth, wishlistController.removeFromWishlist);


router.get('/wallet', userAuth, walletController.getWallet);
router.post('/wallet/refund/return', userAuth, walletController.processReturnRefund);
router.post('/wallet/pay', userAuth, walletController.useWalletForOrder);

router.get('/referral',userAuth,referralController.getReferral)





module.exports = router;