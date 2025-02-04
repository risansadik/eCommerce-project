const mongoose = require("mongoose");
const { Schema } = mongoose;

const returnOrderSchema = new Schema({
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    returnReason: {
        type: String,
        required: true
    },
    returnStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    processedDate: {
        type: Date
    },
    refundAmount: {
        type: Number
    },
    refundStatus: {
        type: String,
        enum: ['Pending', 'Processed', 'Failed'],
        default: 'Pending'
    }
});

const ReturnOrder = mongoose.model("ReturnOrder", returnOrderSchema);

returnOrderSchema.index({ orderId: 1, userId: 1 });

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

module.exports = ReturnOrder;