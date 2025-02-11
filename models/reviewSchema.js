const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        required: true,
        trim: true
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });


reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });


reviewSchema.statics.getReviewStats = async function(productId) {
    const stats = await this.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId) } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
                ratingCounts: {
                    $push: "$rating"
                }
            }
        }
    ]);

    if (stats.length === 0) {
        return {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0
            }
        };
    }

    const ratingDistribution = stats[0].ratingCounts.reduce((acc, rating) => {
        acc[rating] = (acc[rating] || 0) + 1;
        return acc;
    }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

    return {
        averageRating: Number(stats[0].averageRating.toFixed(1)),
        totalReviews: stats[0].totalReviews,
        ratingDistribution
    };
};

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;