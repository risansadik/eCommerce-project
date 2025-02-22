const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const adminOrderController = require('../controllers/admin/adminOrderController');
const adminCouponController = require('../controllers/admin/adminCouponController');
const adminSalesController = require('../controllers/admin/adminSalesController');
const { userAuth, adminAuth } = require('../middlewares/auth');
const multer = require('multer');
const storage = require('../helpers/multer');
const uploads = multer({ storage: storage });
const { uploadProduct } = require('../helpers/productMulter');

//login management

router.get('/pageError', adminController.pageError)
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login)
router.get('/logout', adminController.logout);


//customer management
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked)
router.get('/unblockCustomer', adminAuth, customerController.customerUnblocked)

//category management
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unlistCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);


//product management
router.get('/addProducts', adminAuth, productController.getProductAddPage);
router.post('/addProducts', adminAuth, uploadProduct, productController.addProducts);
router.get('/products', adminAuth, productController.getAllProducts);
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.post('/removeProductOffer', adminAuth, productController.removeProductOffer);
router.get('/blockProduct', adminAuth, productController.blockProduct);
router.get('/unblockProduct', adminAuth, productController.unblockProduct);
router.get('/editProduct', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, uploads.array('images', 4), productController.editProduct);
router.post('/deleteImage', adminAuth, productController.deleteSingleImage);

//order management
router.get('/orders', adminAuth, adminOrderController.getAllOrders);
router.post('/orders/:orderId/status', adminAuth, adminOrderController.updateOrderStatus);
router.post('/orders/:orderId/cancel', adminAuth, adminOrderController.cancelOrder);
router.post('/returns/submit', adminAuth, adminOrderController.submitReturnRequest);

//orderReturn management
router.get('/returns', adminAuth, adminOrderController.getReturnRequests);
router.post('/returns/:returnId/approve',adminAuth,adminOrderController.approveReturnRequest);
router.post('/returns/:returnId/reject',adminAuth, adminOrderController.rejectReturnRequest);


//coupon management
router.get('/coupons', adminAuth, adminCouponController.getCoupon);
router.get('/addCoupons', adminAuth, adminCouponController.addCoupon);
router.post('/createCoupon', adminAuth, adminCouponController.createCoupon);
router.post('/deleteCoupon/:id', adminAuth, adminCouponController.deleteCoupon);

router.get('/sales-report', adminAuth, adminSalesController.loadSalesReport);
router.post('/sales-report/filter', adminAuth, adminSalesController.filterSalesReport);
router.post('/sales-report/excel', adminSalesController.downloadExcel);









module.exports = router