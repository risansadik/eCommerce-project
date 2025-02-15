const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config();
const session = require('express-session');

function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 4; i++) {
        otp += digits[Math.floor(Math.random() * digits.length)];  
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {


        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
            debug: true
        });

       
        await transporter.verify();

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP : ${otp}</h4><br></b>`
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Detailed error in sending email:", error);
        return false;
    }
}

const securePassword = async (password) => {
    if (!password) {
        throw new Error('Password is required');
    }
    
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error('Password hashing failed:', error);
        throw error; 
    }
};

const getForgotPassPage = async (req, res) => {
    try {
        res.render('forgot-password');
    } catch (error) {
        console.error("Error in getForgotPassPage:", error);
        res.status(500).redirect('/pageNotFound');
    }
}

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                return res.render('forgotPass-otp');  
            } else {
                return res.status(500).json({
                    success: false,
                    message: "Failed to send OTP. Please try again"
                });
            }
        } else {
            return res.render('forgot-password', {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        return res.status(500).redirect('/pageNotFound');
    }
}

const verifyForgotPassOtp = async (req, res) => {

    try {

        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {

            res.json({ success: true, redirectUrl: '/reset-password' });
        } else {

            res.json({ success: false, message: "OTP not matching" });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: "An error occured please try again" });

    }
}



const getResetPassPage = async (req, res) => {

    try {

        res.render('reset-password')
    } catch (error) {

        res.redirect('/pageNotFound')

    }
}

const resendOtp = async (req, res) => {

    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            res.status(200).json({ success: true, message: "Resend OTP successful" });

        }

    } catch (error) {

        console.error("Error in resending otp", error);
        res.status(500).json({ success: false, message: "Internal Server error" });

    }
}

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;  

        if (!email) {
            return res.json({
                success: false,
                message: "Session expired. Please try again"
            });
        }

        if (!newPass1 || !newPass2) {
            return res.json({
                success: false,
                message: "Please provide both passwords"
            });
        }

        if (newPass1 !== newPass2) {
            return res.json({
                success: false,
                message: "Passwords do not match"
            });
        }

        const passwordHash = await securePassword(newPass1);
        await User.updateOne({ email: email }, { $set: { password: passwordHash } });

        
        req.session.userOtp = null;
        req.session.email = null;

        return res.json({ success: true });

    } catch (error) {
        console.error('Password reset error:', error);
        return res.json({
            success: false,
            message: "An error occurred while changing your password"
        });
    }
};
const loadDashboard = async (req, res) => {
    try {
     
        
       const user = req.user || await User.findOne({_id:req.session.user});

       if(user){

        const isGoogle = !!req.user.googleId

        res.render('dashboard',{

            id:user._id,
            name:user.name,
            email:user.email,
            phone:user.phone,
            isGoogle:isGoogle
            
        })

           
        }else{

            res.status(404).send('User not found')
        }
    

    } catch (error) {

        console.log("error during loading dashboard", error);
        res.redirect('/pageNotFound')

    }
}

const getUserEditPage = async (req,res) => {

   
    try {

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const user = req.user || await User.findOne({_id:req.session.user});

        if(user){

            res.render('edit-userProfile',{

                id:user._id,
                user:user,
                name:user.name,
                phone:user.phone,
                isGoogle:req.user.googleId
            });
        }
       
    } catch (error) {

        console.log('get edit profile error : ',error);
        res.redirect('/pageNotFound');
        
    }
}

const editUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const {name, phone, password, cPassword} = req.body;
        

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({success: false, message: "User not found"});
        }

       
        const updateData = {
            name: name,
            phone: phone
        };

       
        if (!user.googleId && password) {
            if (password !== cPassword) {
                return res.status(400).json({success: false, message: "Passwords don't match"});
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            {new: true}
        );

        return res.json({
            success: true,
            message: "User updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.log('Edit user error:', error);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
};

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    loadDashboard,
    getUserEditPage,
    editUser

};