const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const {userAuth , adminAuth} = require('../middlewares/auth');

//login management

router.get('/pageError',adminController.pageError)
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login)
router.get('/',adminAuth,adminController.loadDashboard);
router.get('/logout',adminController.logout);


//customer management
router.get('/users',adminAuth,customerController.customerInfo);
router.get('/blockCustomer',adminAuth,customerController.customerBlocked)
router.get('/unblockCustomer',adminAuth,customerController.customerUnblocked)





module.exports = router