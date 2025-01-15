const Cart = require('../../models/categorySchema');
const User = require('../../models/userSchema');


const getCart = async (req,res) => {

    try {
        
        res.render('cart');
    } catch (error) {
        
    }
}

module.exports = {
    getCart
}