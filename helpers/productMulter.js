const multer = require('multer');
const path = require('path');


const productStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/product-images');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});


const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};


const uploadProduct = multer({
    storage: productStorage,
    limits: {
        fileSize: 5 * 1024 * 1024,  
        files: 4  
    },
    fileFilter: fileFilter
}).array('images', 4);


module.exports = {
    uploadProduct
};