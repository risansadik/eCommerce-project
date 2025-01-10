const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const User = require('../../models/userSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const getProductAddPage = async (req, res) => {

    try {

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });
        res.render("product-brand", {
            cat: category,
            brand: brand
        });


    } catch (error) {

        res.redirect('/admin/pageError');

    }
}

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const productExists = await Product.findOne({
            productName: products.productName,
        });

        if (!productExists) {
            const images = [];

            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', 'resized-' + req.files[i].filename);

                    try {
                        await sharp(originalImagePath)
                            .resize({ width: 440, height: 440 })
                            .toFile(resizedImagePath);
                        images.push('resized-' + req.files[i].filename);
                    } catch (sharpError) {
                        console.error('Sharp error:', sharpError);
                        return res.status(500).json({
                            success: false,
                            message: "Error processing images"
                        });
                    }
                }
            }

            const categoryId = await Category.findOne({ name: products.category });

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category name"
                });
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                // brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdAt: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                productImage: images,
                status: 'Available',
            });

            await newProduct.save();
            return res.status(200).json({
                success: true,
                message: "Product added successfully!"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Product already exists, please try with another name"
            });
        }
    } catch (error) {
        console.error('Error saving product:', error);
        return res.status(500).json({
            success: false,
            message: "Error saving product"
        });
    }
}

const getAllProducts = async (req, res) => {
    try {
     
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

       
        const searchQuery = {
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
            ],
        };

       
        const count = await Product.countDocuments(searchQuery);

        // Get products with pagination
        const productData = await Product.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .exec();

        // Get categories and brands
        const category = await Category.find({ isListed: true });

        console.log("Product Data:", productData.map(p => ({
            name: p.productName,
            images: p.productImage
        })));


        if (category && brand) {
            res.render('products', {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
                search: search // Pass search to template
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

        // Input validation
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

        // Check if category offer is better
        if (findCategory.categoryOffer > percentage) {
            return res.status(400).json({
                status: false,
                message: "Category offer is better than the proposed product offer"
            });
        }

        // Calculate new sale price
        const discountAmount = Math.floor(findProduct.regularPrice * (percentage / 100));
        const newSalePrice = findProduct.regularPrice - discountAmount;

        // Update product
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

        // Input validation
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

        // Reset price to regular price if offer exists
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

// Controller fixes
const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id });
        const category = await Category.find({});
        const brand = await Brand.find({});
        res.render('edit-product', {
            product: product,
            cat: category,
            brand: brand
        });
    } catch (error) {
        console.error('Error in getEditProduct:', error);
        res.redirect('/admin/pageError');
    }
};

// Add this to your editProduct controller
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        // Find the product first to ensure it exists
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check for duplicate product name
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

        // Find category by name and get its ID
        const category = await Category.findOne({ name: data.category });
        if (!category) {
            return res.json({
                success: false,
                message: "Invalid category"
            });
        }

        const updateFields = {
            productName: data.productName,
            description: data.descriptionData,
            brand: data.brand,
            category: category._id,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            color: data.color
        };

        // Handle image updates
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

        // Update the product
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
            message: "An error occurred while updating the product"
        });
    }
};
const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;

        // Remove image from product document
        await Product.findByIdAndUpdate(
            productIdToServer,
            { $pull: { productImage: imageNameToServer } }
        );

        // Delete physical file
        const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
            res.json({ status: true });
        } else {
            console.log(`Image ${imageNameToServer} not found`);
            res.json({ status: false, message: 'Image file not found' });
        }
    } catch (error) {
        console.error('Error in deleteSingleImage:', error);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { productId } = req.body;

        // Find the product to get image paths
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Delete associated images from filesystem
        if (product.productImage && product.productImage.length > 0) {
            product.productImage.forEach(imageName => {
                const imagePath = path.join("public", "uploads", "product-images", imageName);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
        }

        // Delete the product from database
        await Product.findByIdAndDelete(productId);

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });

    } catch (error) {
        console.error('Error in deleteProduct:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
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
    deleteProduct
}
