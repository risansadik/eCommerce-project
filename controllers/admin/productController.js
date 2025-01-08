const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
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
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdAt: new Date(),
                quantity: products.quantity,
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
        const page = req.query.page || 1;
        const limit = 4;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
            ],
        }).limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('category')
        .exec();

        const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}},
            ],
        }).countDocuments();


        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});

        if(category && brand){
            res.render('products',{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
            })
        }else{
            res.render('page-404');
        }

    } catch (error) {

        res.redirect('/admin/pageError');
    }
}
module.exports = {

    getProductAddPage,
    addProducts,
    getAllProducts
}
