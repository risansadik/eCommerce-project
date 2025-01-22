const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require('../controllers/user/profileController');
const addressController = require('../controllers/user/addressController');
const cartController = require('../controllers/user/cartController');
const checkoutController = require('../controllers/user/checkoutController')
const passport = require('passport');
const { blockAuth,userAuth , adminAuth} = require('../middlewares/auth');


router.get('/', blockAuth, userController.loadHomePage);
router.get('/pageNotFound', userController.pageNotFound);
router.get('/signin', userController.loadSignIn);
router.post('/signin', userController.signin);
router.get('/signup', userController.loadSignUp)
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/logout', userController.logout)
router.get('/shop', blockAuth,userController.getShopPage);
router.get('/productDetails',blockAuth, userController.getProductDetails);


router.get('/auth/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account'  // Forces Google account selection
    })
);

router.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/signin',
        failureMessage: true
    }),
    (req, res) => {
        // Set both passport user and your session user
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

//cart management

router.post('/addCart', userAuth, cartController.addToCart);
router.get('/cart', userAuth, cartController.getCart);
router.put('/updateCart', userAuth, cartController.updateCartItem);
router.delete('/removeCart/:itemId', userAuth, cartController.removeCartItem);

//checkout management

router.get('/checkout', userAuth, checkoutController.getCheckout);
router.post('/process-checkout', userAuth, checkoutController.processCheckout);



module.exports = router;