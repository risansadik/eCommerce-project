const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');

const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            model: 'Product',
            select: 'productName productImage regularPrice salePrice sizeVariants'
        });

        res.render('wishlist', {
            wishlist: wishlist || { products: [] }
        });
    } catch (error) {
        console.error('Wishlist fetch error:', error);
        res.render('wishlist', {
            wishlist: { products: [] },
            error: 'Failed to load wishlist'
        });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;


        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
        } else {
            // Check if product already exists
            const productExists = wishlist.products.some(item =>
                item.productId.toString() === productId
            );

            if (!productExists) {
                wishlist.products.push({ productId });
            }
        }

        await wishlist.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Add to wishlist error:', error);
        res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
    }
}

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.productId;

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Remove from wishlist error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove from wishlist' });
    }
}

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};