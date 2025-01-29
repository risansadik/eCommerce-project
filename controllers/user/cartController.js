const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');



const getCart = async (req, res) => {
    try {
        const userId = req.user._id;
        let itemsRemoved = false;
        let stockMessage = null;

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'productName productImage salePrice status isBlocked category sizeVariants',
                populate: {
                    path: 'category',
                    select: 'isListed'
                }
            });

        if (cart && cart.items.length > 0) {
            // Filter out invalid products and check stock
            const validItems = cart.items.filter(item => {
                const isValid = !item.productId.isBlocked && item.productId.category?.isListed;
                
                // Check stock in size variant
                const sizeVariant = item.productId.sizeVariants.find(v => v.size === item.size);
                const hasStock = sizeVariant && sizeVariant.quantity >= item.quantity;
                
                if (!hasStock) {
                    stockMessage = `${item.productId.productName} is out of stock in size ${item.size}`;
                    itemsRemoved = true;
                    return false;
                }
                
                if (!isValid) {
                    itemsRemoved = true;
                }
                return isValid;
            });

            if (itemsRemoved) {
                // Update cart with only valid items
                cart.items = validItems;
                await cart.save();
            }
        }

        const cartTotal = cart ? cart.items.reduce((total, item) => total + item.totalPrice, 0) : 0;

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                success: true,
                cart: cart || { items: [] },
                cartTotal,
                message: stockMessage || (itemsRemoved ? 'Some unavailable items were removed from your cart' : null)
            });
        }

        const user = req.user;
        res.render('cart', {
            user: user,
            cart: cart || { items: [] },
            cartTotal,
            message: stockMessage || (itemsRemoved ? 'Some unavailable items were removed from your cart' : null)
        });

    } catch (error) {
        console.error('Get cart error:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({
                success: false,
                message: 'Error fetching cart'
            });
        }
        res.status(500).render('error', { message: 'Error fetching cart' });
    }
};
const addToCart = async (req, res) => {
    try {
        const { productId, size, quantity } = req.body;
        const userId = req.user._id;


        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item =>
            item.productId.toString() === productId &&
            item.size === size
        );

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot add more than 5 items of the same product'
                });
            }
            existingItem.quantity = newQuantity;
            existingItem.totalPrice = existingItem.price * newQuantity;
        } else {
            cart.items.push({
                productId,
                size,
                quantity,
                price: product.salePrice,
                totalPrice: product.salePrice * quantity,
                status: 'placed'
            });
        }

        await cart.save();


        res.status(200).json({
            success: true,
            message: 'Product added to cart successfully',
            redirect: '/cart'
        });

    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding product to cart'
        });
    }
};

const updateCartItem = async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const userId = req.user._id;


        if (quantity < 1 || quantity > 5) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be between 1 and 5'
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const cartItem = cart.items.id(itemId);
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Cart item not found'
            });
        }


        const product = await Product.findById(cartItem.productId);
        if (!product || product.isBlocked || product.status !== "Available") {
            return res.status(400).json({
                success: false,
                message: 'Product is currently unavailable'
            });
        }

        const sizeVariant = product.sizeVariants.find(v => v.size === cartItem.size);
        if (!sizeVariant || sizeVariant.quantity < quantity ) {
            return res.status(400).json({
                success: false,
                message: 'Not enough stock available'
            });
        }

        cartItem.quantity = quantity;
        cartItem.totalPrice = cartItem.price * quantity;
        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Cart updated successfully',
            newTotal: cartItem.totalPrice
        });

    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating cart'
        });
    }
};


const removeCartItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user._id;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Item removed from cart'
        });

    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing item from cart'
        });
    }
}

module.exports = {

    addToCart,
    getCart,
    updateCartItem,
    removeCartItem
}