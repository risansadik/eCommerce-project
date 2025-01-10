const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const profileController = require('../controllers/user/profileController');
const passport = require('passport');
const {blockAuth} = require('../middlewares/auth');


router.get('/',blockAuth,userController.loadHomePage);
router.get('/pageNotFound',userController.pageNotFound);
router.get('/signin',userController.loadSignIn);
router.post('/signin',userController.signin);
router.get('/signup',userController.loadSignUp)
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
router.get('/logout',userController.logout)
router.get('/shop',userController.getShopPage);
router.get('/productDetails',userController.getProductDetails);


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res) => {
    res.redirect('/')
});

//profile management

router.get('/forgot-password',profileController.getForgotPassPage);
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.post('/verify-passforgot-otp',profileController.verifyForgotPassOtp);
router.get('/reset-password',profileController.getResetPassPage);
router.post('/resend-forgot-otp',profileController.resendOtp);
router.post('/reset-password',profileController.postNewPassword);


module.exports = router;