const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletTransactionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: false
    },
    transactionType: {
        type: String,
        enum: ['refund', 'purchase','referral'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [walletTransactionSchema],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});


walletSchema.methods.addRefund = async function(amount, orderId) {
    try {
        const transaction = {
            userId: this.userId,
            type: 'credit',
            amount: amount,
            description: `Refund for order #${orderId}`,
            orderId: orderId,
            transactionType: 'refund'
        };

        this.balance += amount;
        this.transactions.push(transaction);
        this.lastUpdated = Date.now();
        
        return await this.save();
    } catch (error) {
        throw error;
    }
};


walletSchema.methods.useForPurchase = async function(amount, orderId) {
    try {
        if (this.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }

        const transaction = {
            userId: this.userId,
            type: 'debit',
            amount: amount,
            description: `Purchase payment for order #${orderId}`,
            orderId: orderId,
            transactionType: 'purchase'
        };

        this.balance -= amount;
        this.transactions.push(transaction);
        this.lastUpdated = Date.now();
        
        return await this.save();
    } catch (error) {
        throw error;
    }
};

walletSchema.methods.addRefund = async function(amount, orderId = null, description = 'Refund', transactionType = 'refund') {
    try {
        const transaction = {
            userId: this.userId,
            type: 'credit',
            amount: amount,
            description: description,
            orderId: orderId,
            transactionType: transactionType
        };

        this.balance += amount;
        this.transactions.push(transaction);
        this.lastUpdated = Date.now();

        return await this.save();
    } catch (error) {
        throw error;
    }
};
const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;