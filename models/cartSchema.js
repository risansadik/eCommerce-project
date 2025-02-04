const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        size: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1,
            max: 5
        },
        price: {
            type: Number,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            default: 'placed',
        },
        cancellationReason: {
            type: String,
            default: "none"
        }
    }],
    appliedCoupon: {
        couponId: {
            type: Schema.Types.ObjectId,
            ref: 'Coupon',
            default: null
        },
        discount: {
            type: Number,
            default: 0
        }
    }
});

// Pre-save middleware to calculate totalPrice
cartSchema.pre('save', function (next) {
    this.items.forEach(item => {
        item.totalPrice = item.price * item.quantity;
    });
    next();
});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;