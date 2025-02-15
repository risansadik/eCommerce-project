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
        },
        cancellationReason: {
            type: String,
            default: null
        },
        cancelledAt: {
            type: Date,
            default: null
        }
    }],
    cancellationReason: {
        type: String,
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
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
    },
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    invoiceGeneratedAt: {
        type: Date
    },
    invoiceStatus: {
        type: String,
        enum: ['pending', 'generated', 'failed'],
        default: 'pending'
    }
});

orderSchema.pre('find', function(next) {
    next();
});

orderSchema.pre('findOne', function(next) {
    next();
});

orderSchema.methods.recalculateTotals = function() {
    

    const normalizedItems = this.orderedItems.map((item, index) => {
        // Ensure numeric values
        const basePrice = Number(item.price/item.quantity); 
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
    const activeItems = normalizedItems.filter(item => item.status !== 'Cancelled');

    this.totalPrice = Number(
        activeItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );

 
    const discount = Number(this.discount || 0);
    this.finalAmount = Number((this.totalPrice - discount).toFixed(2));

   
    if (activeItems.length === 0) {
        this.status = 'Cancelled';
        this.totalPrice = 0;
        this.finalAmount = 0;
        this.discount = 0;
        
     
        this.couponApplied = {
            couponCode: null,
            couponId: null,
            discountAmount: 0
        };
    }

    return this;
};


orderSchema.pre('save', function(next) {
    try {
        this.recalculateTotals();
        next();
    } catch (error) {
        next(error);
    }
});

orderSchema.methods.generateInvoiceNumber = async function() {
    if (!this.invoiceNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
      
        const latestInvoice = await this.constructor.findOne({
            invoiceNumber: { $regex: `INV-${year}${month}-` }
        })
        .sort({ invoiceNumber: -1 });

        let sequence = '00001';
        if (latestInvoice && latestInvoice.invoiceNumber) {
            const lastSequence = parseInt(latestInvoice.invoiceNumber.split('-')[2]) + 1;
            sequence = String(lastSequence).padStart(5, '0');
        }

        this.invoiceNumber = `INV-${year}${month}-${sequence}`;
        this.invoiceGeneratedAt = date;
        this.invoiceStatus = 'generated';
    }
    return this.invoiceNumber;
};

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;