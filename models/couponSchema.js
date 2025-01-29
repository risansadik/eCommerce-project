const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    code: {  
        type: String,
        required: true,
        unique: true,
    },
    createdOn: { 
        type: Date,
        default: Date.now,
        required: true
    },
    expireOn: { 
        type: Date,
        required: true
    },
    offerPrice: {  
        type: Number,
        required: false  
    },
    discountPercentage: {  
        type: Number,
        required: false
    },
    minimumPrice: { 
        type: Number,
        required: true
    },
    isList: { 
        type: Boolean,
        default: true
    },
    status: { 
        type: String,
        enum: ['active', 'inactive', 'expired'],
        default: 'active'
    },
    maxRedemptionCount: { 
        type: Number,
        default: 1 
    },
    userLimit: {  
        type: Number,
        default: 1
    },
    userId: [{ 
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
