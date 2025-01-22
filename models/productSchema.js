const mongoose = require("mongoose");
const { Schema } = mongoose;

const sizeVariantSchema = new Schema({
    size: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    }
});


const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true,
    },
    salePrice: {
        type: Number,
        required: true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    sizeVariants: {
        type: [sizeVariantSchema],
        required: true,
        validate: [arrayMinLength, 'At least one size variant is required']
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "out of stock", "Discontinued"],
        required: true,
        default: "Available"
    },
    displayLocation : {
        type : String,
        enum : ['home' , 'shop' , 'both'],
        default : 'shop'
    }
}, { timestamps: true });

function arrayMinLength(val) {
    return val.length > 0;
}

productSchema.virtual('totalQuantity').get(function() {
    return this.sizeVariants.reduce((total, variant) => total + variant.quantity, 0);
});

productSchema.pre('save', function(next) {
    const totalQty = this.sizeVariants.reduce((sum, variant) => sum + variant.quantity, 0);
    this.status = totalQty > 0 ? "Available" : "out of stock";
    next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;