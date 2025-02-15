const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const User = require('../../models/userSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const getProductAddPage = async (req, res) => {

    try {

        const category = await Category.find({ isListed: true });
        res.render("add-product", {
            cat: category,
            product: {
                sizeVariants: []
            }

        });


    } catch (error) {

        res.redirect('/admin/pageError');

    }
}
const addProducts = async (req, res) => {
    try {
      
     
       
        const sizes = req.body.sizes || req.body['sizes[]'];
        const quantities = req.body.quantities || req.body['quantities[]'];


        
        const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
        const quantityArray = Array.isArray(quantities) ? quantities : [quantities];

      
        const sizeVariants = sizeArray
            .map((size, index) => {
                const sizeValue = size ? size.toString().trim() : '';
                const quantityValue = quantityArray[index] ? parseInt(quantityArray[index]) : 0;

                return {
                    size: sizeValue,
                    quantity: quantityValue
                };
            })
            .filter(variant => variant.size !== '');


    
        if (!sizeVariants || sizeVariants.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please add at least one size variant with a valid size and quantity"
            });
        }

        
        const totalQuantity = sizeVariants.reduce((sum, variant) => sum + variant.quantity, 0);

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please upload at least one product image"
            });
        }

      
        const imagePaths = req.files.map(file => file.filename);

        const newProduct = new Product({
            productName: req.body.productName,
            description: req.body.description,
            category: req.body.category,
            regularPrice: parseFloat(req.body.regularPrice),
            salePrice: parseFloat(req.body.salePrice),
            sizeVariants: sizeVariants,
            productImage: imagePaths,
            status: totalQuantity > 0 ? 'Available' : 'out of stock',
            displayLocation: req.body.displayLocation || 'shop',
        });

        await newProduct.save();

        return res.status(200).json({
            success: true,
            message: "Product added successfully!"
        });
    } catch (error) {
        console.error('Error in addProducts:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error saving product"
        });
    }
};
const getAllProducts = async (req, res) => {
    try {

        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;


        const searchQuery = {
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },

            ],
        };


        const count = await Product.countDocuments(searchQuery);


        const productData = await Product.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .exec();


        const category = await Category.find({ isListed: true });

        if (category) {
            res.render('products', {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                search: search
            });
        } else {
            res.render('page-404');
        }

    } catch (error) {
        console.error('Error in getAllProducts:', error);
        res.redirect('/admin/pageError');
    }
};


const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;

        
        if (!productId || !percentage || percentage < 0 || percentage > 100) {
            return res.status(400).json({
                status: false,
                message: "Invalid input parameters"
            });
        }

        const findProduct = await Product.findById(productId);
        if (!findProduct) {
            return res.status(404).json({
                status: false,
                message: "Product not found"
            });
        }

        const findCategory = await Category.findById(findProduct.category);
        if (!findCategory) {
            return res.status(404).json({
                status: false,
                message: "Category not found"
            });
        }

        
        if (findCategory.categoryOffer > percentage) {
            return res.status(400).json({
                status: false,
                message: "Category offer is better than the proposed product offer"
            });
        }

       
        const discountAmount = Math.floor(findProduct.regularPrice * (percentage / 100));
        const newSalePrice = findProduct.regularPrice - discountAmount;

        
        findProduct.salePrice = newSalePrice;
        findProduct.productOffer = parseInt(percentage);
        await findProduct.save();

        return res.json({
            status: true,
            message: "Offer added successfully"
        });

    } catch (error) {
        console.error('Error in addProductOffer:', error);
        return res.status(500).json({
            status: false,
            message: "Internal Server Error"
        });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;

       
        if (!productId) {
            return res.status(400).json({
                status: false,
                message: "Product ID is required"
            });
        }

        const findProduct = await Product.findById(productId);
        if (!findProduct) {
            return res.status(404).json({
                status: false,
                message: "Product not found"
            });
        }

        
        if (findProduct.productOffer > 0) {
            findProduct.salePrice = findProduct.regularPrice;
            findProduct.productOffer = 0;
            await findProduct.save();
        }

        return res.json({
            status: true,
            message: "Offer removed successfully"
        });

    } catch (error) {
        console.error('Error in removeProductOffer:', error);
        return res.status(500).json({
            status: false,
            message: "Internal Server Error"
        });
    }
};

const blockProduct = async (req, res) => {

    try {

        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect('/admin/products');

    } catch (error) {

        res.redirect('/admin/pageError');

    }
}

const unblockProduct = async (req, res) => {

    try {

        const id = req.query.id;

        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/products");

    } catch (error) {

        res.redirect('/admin/pageError');

    }
};


const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id });
        const category = await Category.find({});
        res.render('edit-product', {
            product: product,
            cat: category,
        });
    } catch (error) {
        console.error('Error in getEditProduct:', error);
        res.redirect('/admin/pageError');
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

       
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.json({
                success: false,
                message: "Product with this name already exists"
            });
        }

        
        const category = await Category.findOne({ name: data.category });
        if (!category) {
            return res.json({
                success: false,
                message: "Invalid category"
            });
        }

        const regularPrice = parseFloat(data.regularPrice);
        const salePrice = parseFloat(data.salePrice);

        if (isNaN(regularPrice) || regularPrice <= 0) {
            return res.json({
                success: false,
                message: "Invalid regular price"
            });
        }

        if (isNaN(salePrice) || salePrice <= 0) {
            return res.json({
                success: false,
                message: "Invalid sale price"
            });
        }

        let sizes = data.sizes;        
        let quantities = data.quantities;
        
        if (!Array.isArray(sizes)) {
            sizes = sizes ? [sizes] : [];
        }
        if (!Array.isArray(quantities)) {
            quantities = quantities ? [quantities] : [];
        }
        
        
        const sizeVariants = sizes.map((size, index) => {
            if (!size || size.trim() === '') {
                throw new Error('Size cannot be empty');
            }
            const quantity = parseInt(quantities[index]);
            if (isNaN(quantity) || quantity < 0) {
                throw new Error('Invalid quantity');
            }
            return {
                size: size.trim(),
                quantity: quantity
            };
        });

      
        const totalQuantity = sizeVariants.reduce((sum, variant) => sum + variant.quantity, 0);

        const updateFields = {
            productName: data.productName,
            description: data.descriptionData,
            category: category._id,
            regularPrice: regularPrice,
            salePrice: salePrice,
            sizeVariants: sizeVariants,
            status: totalQuantity > 0 ? "Available" : "out of stock",
            displayLocation: data.displayLocation || product.displayLocation,
        };

   
        if (req.files && req.files.length > 0) {
            const images = [];
            for (const file of req.files) {
                const resizedImagePath = path.join('resized-' + file.filename);
                await sharp(file.path)
                    .resize(440, 440)
                    .toFile(path.join('public', 'uploads', 'product-images', resizedImagePath));
                images.push(resizedImagePath);
            }
            updateFields.productImage = [...product.productImage, ...images];
        }

        
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.json({
                success: false,
                message: "Product update failed"
            });
        }

        return res.json({
            success: true,
            message: "Product updated successfully"
        });

    } catch (error) {
        console.error('Error in editProduct:', error);
        return res.json({
            success: false,
            message: error.message || "An error occurred while updating the product"
        });
    }
};
const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;

        
        await Product.findByIdAndUpdate(
            productIdToServer,
            { $pull: { productImage: imageNameToServer } }
        );

      
        const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            res.json({ status: true });
        } else {
            res.json({ status: false, message: 'Image file not found' });
        }
    } catch (error) {
        console.error('Error in deleteSingleImage:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};




module.exports = {

    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
}
