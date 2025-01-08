const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search ? req.query.search.trim() : ""; // Trim the search input

        // Create search query with case-insensitive search
        const searchQuery = {
            $or: [
                // Using $regex with $options: 'i' for case-insensitive search
                { name: { $regex: new RegExp(search, 'i') } },
                { description: { $regex: new RegExp(search, 'i') } }
            ]
        };

        const categoryData = await Category.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError');
    }
};
const addCategory = async (req, res) => {

    const { name, description } = req.body;

    try {

        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const newCategory = new Category({
            name,
            description,
        })
        await newCategory.save();
        res.json({ message: "Category added successfully" })

    } catch (error) {

        return res.status(500).json({ error: "Internal server error" })

    }
}

const addCategoryOffer = async (req, res) => {

    try {

        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });
        const hasProductOffer = products.some((product) => product.productOffer > percentage);
        if (hasProductOffer) {
            return res.json({ status: false, message: "Products within this category already have product offers" });
        }
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

        for (const product of products) {
            product.productOffer = 0;
            product.salePrice = product.regularPrice;
            await product.save();
        }
        res.json({ status: true });


    } catch (error) {

        res.status(500).json({ status: false, message: "Internal Server Error" });

    }
}

const removeCategoryOffer = async (req, res) => {

    try {
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if (!category) {

            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const percentage = category.categoryOffer;
        const products = await Product.find({ category: category._id });

        if (products.length > 0) {
            for (const product of products) {

                product.salePrice += Math.floor(product.regularPrice * (percentage / 100));
                product.productOffer = 0;
                await product.save();
            }
        }
        category.categoryOffer = 0;
        await category.save();
        res.json({ status: true })
    } catch (error) {

        res.status(500).json({ status: false, message: "Internal Server Error" });

    }
}

const getListCategory = async (req, res) => {

    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect('/admin/category');

    } catch (error) {

        res.redirect('/admin/pageError');

    }
}

const getUnlistCategory = async (req, res) => {


    try {

        const id = req.query.id;

        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect('/admin/category');

    } catch (error) {

        res.redirect('/admin/pageError');

    }

}

const getEditCategory = async (req, res) => {

    try {

        const id = req.query.id;
        const category = await Category.findOne({ _id: id });
        res.render('edit-category', { category: category });
    } catch (error) {

        res.redirect('/pageError');

    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        // Check if either categoryName or description is empty
        if (!categoryName || !description) {
            return res.status(400).json({ error: "Name and description cannot be empty" });
        }

        // Fetch the current category to compare with new values
        const currentCategory = await Category.findById(id);

        if (!currentCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Check if name and description are the same as the current category
        if (currentCategory.name === categoryName && currentCategory.description === description) {
            return res.status(400).json({ error: "No changes were made" });
        }

        // Check if another category with the same name exists (excluding the current category by ID)
        const existingCategory = await Category.findOne({
            name: categoryName,
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({ error: "Category with the same name already exists" });
        }

        // Proceed with the update
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description: description },
            { new: true }
        );

        if (updatedCategory) {
            return res.status(200).json({ success: "Category updated successfully" });
        } else {
            return res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {

    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
}