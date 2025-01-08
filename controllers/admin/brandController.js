const Brand = require('../../models/brandSchema');
const Product = require('../../models/productSchema');

const getBrandPage = async (req, res) => {

    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const brandData = await Brand.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
        const reverseBrand = brandData.reverse();
        res.render('brands', {
            data: reverseBrand,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        })

    } catch (error) {

        res.redirect('/admin/pageError')

    }
}

const addBrand = async (req, res) => {
    try {
        const brand = req.body.name;
        const findBrand = await Brand.findOne({ brandName: brand });
        
        if (findBrand) {
            return res.json({ success: false, message: 'Brand already exists!' });
        }

        const image = req.file.filename;
        const newBrand = new Brand({
            brandName: brand,
            brandImage: image,
        });
        await newBrand.save();
        
        res.json({ success: true, message: 'Brand added successfully!' });
    } catch (error) {
        res.json({ success: false, message: 'Error adding brand!' });
    }
}
const blockBrand = async (req,res) => {
    try {
        

        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect('/admin/brands');

    } catch (error) {
        console.log("error during blocking brand",error);
        res.redirect('/admin/pageError');
        
    }
}
const unblockBrand = async (req,res) => {
    try {
        

        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect('/admin/brands');

    } catch (error) {

        console.log("error during unblocking brand",error);
        res.redirect('/admin/pageError');
        
    }
}

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.redirect('/admin/brands');
        }
        await Brand.deleteOne({ _id: id });
        return res.redirect('/admin/brands');
    } catch (error) {
        console.error("error deleting brand", error);
        return res.redirect('/admin/brands');
    }
}
module.exports = {

    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}