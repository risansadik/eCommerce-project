const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');


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

        console.log(`Found ${productData.length} products for home page`);

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

        const { name, mobile, email, password, cPassword } = req.body;

        if (password !== cPassword) {
            return res.render('sign-up', { message: "Passwords do not match" })
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('sign-up', { message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            phone: mobile,
            email,
            password: hashedPassword,
            isAdmin: false,
            isBlocked: false
        })

        await newUser.save();

        console.log("new user saved: ", newUser);

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json("Email-error");
        }

        req.session.userOtp = otp;
        req.session.userData = { name, mobile, email, password };

        res.render("signupOtp");
        console.log("OTP sent", otp);
    } catch (error) {

        console.error("signup error", error);
        res.redirect("/pageNotFound");

    }
}

const verifyOtp = async (req, res) => {
    try {
        const { userOtp } = req.session;
        const { otp } = req.body;

        if (!userOtp) {
            return res.status(400).json({ success: false, message: "OTP not found in session." });
        }

        if (userOtp === otp) {

            req.session.userOtp = null;

            return res.status(200).json({ success: true, message: "OTP verified successfully." });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resend OTP:", otp);
            return res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}
const signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        console.log("Email:", trimmedEmail);
        console.log("Password:", trimmedPassword);

        const findUser = await User.findOne({ email: trimmedEmail });


        if (!findUser) {
            console.log("User not found");
            return res.render("sign-in", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            console.log("User is blocked by admin");
            return res.render("sign-in", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(trimmedPassword, findUser.password);

        if (!passwordMatch) {
            console.log("Password mismatch");
            return res.render("sign-in", { message: "Incorrect Password" });
        }

        req.session.user = findUser._id;



        console.log("User logged in successfully:", findUser._id);

        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.render("sign-in", { message: "Failed to create session" });
            }
            res.redirect('/');
        });

    } catch (error) {
        console.error('Login error', error);
        res.render('sign-in', { message: "Sign-In Failed. Please try again later" });
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
        const sortOption = req.query.sort; // Get sort parameter from URL

        // Get listed categories
        const categories = await Category.find({ isListed: true });
        console.log('Found categories:', categories.map(c => c._id));

        // Build product query
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

        // Add category filter if provided in URL
        if (req.query.category) {
            query.category = req.query.category;
        }

        console.log('Product query:', JSON.stringify(query, null, 2));

        
        let sortObj = { createdAt: -1 }; 
        if (sortOption) {
            switch (sortOption) {
                case 'low':
                    sortObj = { salePrice: 1 };
                    break;
                case 'high':
                    sortObj = { salePrice: -1 };
                    break;
            }
        }

        let productData = await Product.find(query)
            .populate('category')
            .sort(sortObj);

        console.log(`Found ${productData.length} products`);

        if (productData.length > 0) {
            console.log('Sample product:', {
                name: productData[0].productName,
                images: productData[0].images,
                price: productData[0].salePrice,
                location: productData[0].displayLocation
            });
        }

        // Prepare render object
        const renderObj = {
            products: productData,
            categories: categories,
            selectedCategory: req.query.category || null,
            selectedSort: sortOption || null, 
            error: null
        };

        // Add user data if logged in
        if (user) {
            const userData = await User.findById(user);
            if (userData) {
                renderObj.user = userData;
                return res.render('shop', renderObj);
            } else {
                console.log("User data not found");
                return res.redirect('/signin');
            }
        } else {
            return res.render('shop', renderObj);
        }

    } catch (error) {
        console.error('Shop page error:', error);
        return res.render('shop', {
            products: [],
            categories: [],
            error: 'An error occurred while loading products.'
        });
    }
};
const getProductDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        const user = req.session.user;


        const productData = await Product.findById(productId);

        if (!productData) {
            return res.redirect('/pageNotFound');
        }

        if (user) {
            const userData = await User.findById(user);
            if (userData) {
                return res.render('product-details', {
                    user: userData,
                    product: productData
                });
            }
        }

        res.render('product-details', { product: productData });
    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.redirect('/pageNotFound');
    }
};


module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignIn,
    loadSignUp,
    signup,
    resendOtp,
    verifyOtp,
    signin,
    logout,
    getShopPage,
    getProductDetails

}