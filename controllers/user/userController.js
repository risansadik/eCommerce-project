const User = require('../../models/userSchema');
const generateUniqueReferralCode = require('../../models/userSchema').generateUniqueReferralCode;
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');
const Wallet = require('../../models/walletSchema')


const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });

        const query = {
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            'sizeVariants': {
                $elemMatch: {
                    'quantity': { $gt: 0 }
                }
            },
            displayLocation: { $in: ['home', 'both'] }
        };

        let productData = await Product.find(query)
            .populate('category')
            .sort({ createdAt: -1 });

        const renderData = {
            products: productData,
            error: null
        };

        if (user) {
            const userData = await User.findById(user);
            if (userData) {
                renderData.user = userData;
            }
        }

        return res.render('home', renderData);

    } catch (error) {
        console.error('Error loading home page:', error);
        return res.render('home', {
            products: [],
            error: 'An error occurred while loading the page.'
        });
    }
};

const about = async (req, res) => {

    try {

        const user = req.session.user;

        const renderObj = {
            user: null
        }

        if (user) {

            const userData = await User.findById(user);
            if (userData) {

                renderObj.user = userData;
            }
        }



        res.render('about', renderObj);
    } catch (error) {
        console.log('error loading about page', error);
        res.render('page-404');

    }
}

const contact = async (req, res) => {

    try {

        const user = req.session.user;

        const renderObj = {
            user: null
        }

        if (user) {

            const userData = await User.findById(user);
            if (userData) {

                renderObj.user = userData;
            } 
        }



        res.render('contact', renderObj);
    } catch (error) {
        console.log('Error loading contact page : ', error);
        res.render('page-404');

    }
}
const pageNotFound = async (req, res) => {

    try {

        res.render("page-404");
    } catch (error) {

        res.redirect('/pageNotFound');
    }
}
const loadSignIn = async (req, res) => {

    try {
        return res.render('sign-in');

    } catch (error) {

        console.log('page not loading', error);
        res.status(500).send('Server error');
    }
}

const loadSignUp = async (req, res) => {
    try {

        return res.render('sign-up');
    } catch (error) {
        console.log('page not found', error);
        res.status(500).send('Server error');

    }
}

function generateOtp() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP : ${otp}</b>`,
        })

        return info.accepted.length > 0
    } catch (error) {

        console.error("Error sending email", error);
        return false;

    }
}

const signup = async (req, res) => {
    try {
        const { name, mobile, email, password, cPassword, referralCode } = req.body;

        if (password !== cPassword) {
            return res.render('sign-up', { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('sign-up', { message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newReferralCode = generateUniqueReferralCode();

        const pendingUser = {
            name,
            phone: mobile,
            email,
            password: hashedPassword,
            referalCode: newReferralCode,
            isAdmin: false,
            isBlocked: false
        };

     
        if (referralCode) {
            const referrer = await User.findOne({ referalCode: referralCode });

            if (referrer) {
       
                pendingUser.referredBy = referrer._id;

          
                let referrerWallet = await Wallet.findOne({ userId: referrer._id });
                if (!referrerWallet) {
                    referrerWallet = new Wallet({ 
                        userId: referrer._id,
                        balance: 0
                    });
                }

               
                try {
                    await referrerWallet.addRefund(100, null, 'Referral Signup Bonus', 'referral');
                    
               
                    referrer.referralCount += 1;
                    await referrer.save();
                } catch (error) {
                    console.error("Error adding referral bonus:", error);
                }
            }
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json("Email-error");
        }

        req.session.userOtp = otp;
        req.session.pendingUser = pendingUser;

        res.render("signupOtp");
        console.log("OTP sent", otp);

    } catch (error) {
        console.error("signup error", error);
        res.redirect("/pageNotFound");
    }
};


const verifyOtp = async (req, res) => {
    try {
        const { userOtp } = req.session;
        const { otp } = req.body;
        const pendingUser = req.session.pendingUser;

        if (!userOtp || !pendingUser) {
            return res.status(400).json({
                success: false,
                message: "OTP verification failed. Please try signing up again."
            });
        }

        if (userOtp === otp) {
            const newUser = new User(pendingUser);
            await newUser.save();

           
            const newWallet = new Wallet({
                userId: newUser._id,
                balance: 0
            });
            await newWallet.save();

            
            if (newUser.referredBy) {
                try {
                    
                    let referrerWallet = await Wallet.findOne({ userId: newUser.referredBy });
                    
                   
                    if (!referrerWallet) {
                        referrerWallet = new Wallet({
                            userId: newUser.referredBy,
                            balance: 0
                        });
                    }

                   
                    await referrerWallet.addRefund(
                        100, 
                        null, 
                        `Referral bonus for ${newUser.email}`, 
                        'referral'
                    );
                } catch (error) {
                    console.error("Error processing referral bonus:", error);
                   
                }
            }

            // Set session
            req.session.user = newUser._id;
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    resolve();
                });
            });

           
            req.session.userOtp = null;
            req.session.pendingUser = null;

            return res.status(200).json({
                success: true,
                message: "Account created successfully! Redirecting to home..."
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const resendOtp = async (req, res) => {
    try {
        const pendingUser = req.session.pendingUser;

        if (!pendingUser || !pendingUser.email) {
            return res.status(400).json({
                success: false,
                message: "No pending registration found. Please try signing up again."
            });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(pendingUser.email, otp);

        if (emailSent) {
            console.log("Resend OTP:", otp);
            return res.status(200).json({
                success: true,
                message: "OTP Resent Successfully"
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "Failed to resend OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};
const signin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        const findUser = await User.findOne({ email: trimmedEmail });

        if (!findUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User not found'
            });
        }

        if (findUser.isBlocked) {
            return res.status(403).json({
                status: 'error',
                message: 'Your account has been blocked by admin'
            });
        }

        const passwordMatch = await bcrypt.compare(trimmedPassword, findUser.password);

        if (!passwordMatch) {
            return res.status(400).json({
                status: 'error',
                message: 'Incorrect Password'
            });
        }

        req.session.user = findUser._id;

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                resolve();
            });
        });

        return res.status(200).json({
            status: 'success',
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login error', error);
        return res.status(500).json({
            status: 'error',
            message: 'Sign-In Failed. Please try again later'
        });
    }
};
const logout = async (req, res) => {

    try {

        req.session.destroy((err) => {
            if (err) {
                console.log("Session destruction error", err.message);
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/signin")
        })
    } catch (error) {

        console.log("Logout error", error);
        res.redirect('/pageNotFound')

    }
}


const getShopPage = async (req, res) => {
    try {
        const user = req.session.user;
        const sortOption = req.query.sort;
        const priceRange = req.query.priceRange;
        const searchQuery = req.query.search;


        const categories = await Category.find({ isListed: true });


        const query = {
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            'sizeVariants': {
                $elemMatch: {
                    'quantity': { $gt: 0 }
                }
            },
            displayLocation: { $in: ['shop', 'both'] }
        };


        if (searchQuery) {
            query.$or = [
                { productName: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                { brand: { $regex: searchQuery, $options: 'i' } }
            ];
        }


        if (req.query.category) {
            query.category = req.query.category;
        }


        if (priceRange) {
            const [min, max] = priceRange.split('-');
            if (max === 'above') {
                query.salePrice = { $gte: parseInt(min) };
            } else {
                query.salePrice = {
                    $gte: parseInt(min),
                    $lte: parseInt(max)
                };
            }
        }


        let productData = await Product.find(query).populate('category');


        const customSort = (a, b) => {
            const nameA = a.productName.replace(/^the\s+/i, '').toLowerCase();
            const nameB = b.productName.replace(/^the\s+/i, '').toLowerCase();

            if (nameA === nameB) {
                return a.productName.toLowerCase().localeCompare(b.productName.toLowerCase());
            }
            return nameA.localeCompare(nameB);
        };

        if (sortOption) {
            switch (sortOption) {
                case 'low':
                    productData.sort((a, b) => a.salePrice - b.salePrice);
                    break;
                case 'high':
                    productData.sort((a, b) => b.salePrice - a.salePrice);
                    break;
                case 'asc':
                    productData.sort((a, b) => customSort(a, b));
                    break;
                case 'desc':
                    productData.sort((a, b) => customSort(b, a));
                    break;
                default:
                    productData.sort((a, b) => b.createdAt - a.createdAt);
            }
        } else {
            productData.sort((a, b) => b.createdAt - a.createdAt);
        }


        const renderObj = {
            products: productData,
            categories: categories,
            selectedCategory: req.query.category || null,
            selectedSort: sortOption || null,
            selectedPriceRange: priceRange || null,
            searchQuery: searchQuery || null,
            error: null,
            user: null
        };


        if (user) {
            const userData = await User.findById(user);
            if (userData) {
                renderObj.user = userData;
            } else {
                return res.redirect('/signin');
            }
        }

        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json(renderObj); 
        }

        return res.render('shop', renderObj);

    } catch (error) {
        console.error('Shop page error:', error);
        return res.render('shop', {
            products: [],
            categories: [],
            selectedCategory: null,
            selectedSort: null,
            selectedPriceRange: null,
            searchQuery: null,
            error: 'An error occurred while loading products.',
            user: null
        });
    }
};
const getProductDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        const user = req.session.user;

        const productData = await Product.findById(productId).populate('category');

        if (!productData || !productData.category || !productData.category.isListed || productData.isBlocked) {
            return res.redirect('/shop');
        }

        const relatedProducts = await Product.find({
            category: productData.category._id,
            _id: { $ne: productId },
            isBlocked: false,
            'sizeVariants': {
                $elemMatch: {
                    'quantity': { $gt: 0 }
                }
            }
        })
            .populate('category')
            .limit(4)
            .sort({ createdAt: -1 })
            .then(products => products.filter(product =>
                product.category && product.category.isListed
            ));

        const renderData = {
            product: productData,
            relatedProducts: relatedProducts,
            user: null,
            isInWishlist: false
        };

        if (user) {
            const userData = await User.findById(user);
            if (userData) {
                renderData.user = userData;


                const wishlist = await Wishlist.findOne({
                    userId: user,
                    'products.productId': productId
                });

                renderData.isInWishlist = !!wishlist;
            }
        }

        res.render('product-details', renderData);
    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.redirect('/shop');
    }
};

module.exports = {
    loadHomePage,
    pageNotFound,
    about,
    contact,
    loadSignIn,
    loadSignUp,
    signup,
    resendOtp,
    verifyOtp,
    signin,
    logout,
    getShopPage,
    getProductDetails,



}