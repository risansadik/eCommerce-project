const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        size: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Active', 'Cancelled'],
            default: 'Active'
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0,
    },
    finalAmount: {
        type: Number,
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
        default: 'Pending'
    },
    createdOn: {
        type: Date,
        default: Date.now,
    },
    couponApplied: {
        couponCode: {
            type: String,
            default: null
        },
        couponId: {
            type: Schema.Types.ObjectId,
            ref: 'Coupon',
            default: null
        },
        discountAmount: {
            type: Number,
            default: 0
        }
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'razorpay','wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed','refunded'],
        default: 'pending'
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    }
});

orderSchema.pre('find', function(next) {
    console.log('Finding order with query:', this.getQuery());
    next();
});

orderSchema.pre('findOne', function(next) {
    console.log('Finding one order with query:', this.getQuery());
    next();
});

orderSchema.methods.recalculateTotals = function() {
    console.log('Starting recalculation...');
    
    // Validate and normalize all items first
    const normalizedItems = this.orderedItems.map((item, index) => {
        // Ensure numeric values
        const basePrice = Number(item.price/item.quantity); // This should be the price per unit
        const quantity = Number(item.quantity);
        
        if (isNaN(basePrice) || isNaN(quantity)) {
            throw new Error(`Invalid numeric values at index ${index}`);
        }

        const subtotal = Number((basePrice * quantity).toFixed(2));
        
        return {
            ...item.toObject(),
            price: basePrice,   
            quantity,
            subtotal
        };
    });

    console.log('Normalized items:', normalizedItems.map(item => ({
        pricePerUnit: item.price,
        quantity: item.quantity,
        status: item.status,
        subtotal: item.subtotal
    })));

    const activeItems = normalizedItems.filter(item => item.status !== 'Cancelled');

    this.totalPrice = Number(
        activeItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );

    // Get discount from coupon if applied
    const discount = Number(this.discount || 0);
    this.finalAmount = Number((this.totalPrice - discount).toFixed(2));

    // Handle fully cancelled orders
    if (activeItems.length === 0) {
        console.log('Order fully cancelled - resetting totals');
        this.status = 'Cancelled';
        this.totalPrice = 0;
        this.finalAmount = 0;
        this.discount = 0;
        
        // Reset coupon information
        this.couponApplied = {
            couponCode: null,
            couponId: null,
            discountAmount: 0
        };
    }

    console.log('Final calculation:', {
        activeItemCount: activeItems.length,
        totalPrice: this.totalPrice,
        discount,
        finalAmount: this.finalAmount,
        status: this.status
    });

    return this;
};

// Pre-save middleware
orderSchema.pre('save', function(next) {
    try {
        this.recalculateTotals();
        next();
    } catch (error) {
        next(error);
    }
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;