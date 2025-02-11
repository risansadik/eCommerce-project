const Review = require('../../models/reviewSchema');
const Product = require('../../models/productSchema');

const reviewController = {
    getProductReviews: async (req, res) => {
        try {
            const { productId } = req.params;
            
            const reviews = await Review.find({ productId })
                .populate('userId', 'name')
                .sort({ createdAt: -1 });

            const stats = await Review.getReviewStats(productId);

            res.json({
                success: true,
                reviews,
                stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error fetching reviews",
                error: error.message
            });
        }
    },

    addReview: async (req, res) => {
        try {
            const { productId } = req.params;
            const { rating, review } = req.body;
            const userId = req.user._id;

            const existingReview = await Review.findOne({ productId, userId });
            if (existingReview) {
                return res.status(400).json({
                    success: false,
                    message: "You have already reviewed this product"
                });
            }

            const newReview = await Review.create({
                productId,
                userId,
                rating,
                review
            });

            const stats = await Review.getReviewStats(productId);

            res.status(201).json({
                success: true,
                review: newReview,
                stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error adding review",
                error: error.message
            });
        }
    },

    deleteReview: async (req, res) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user._id;

            const review = await Review.findOneAndDelete({
                _id: reviewId,
                userId
            });

            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: "Review not found or unauthorized"
                });
            }

            const stats = await Review.getReviewStats(review.productId);

            res.json({
                success: true,
                message: "Review deleted successfully",
                stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error deleting review",
                error: error.message
            });
        }
    }
};

module.exports = reviewController;