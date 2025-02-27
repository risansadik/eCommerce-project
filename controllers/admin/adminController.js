const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {StatusCode} = require('../../config/statusCodes')



const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin');
    }
    res.status(StatusCode.SUCCESS).render("admin-login", { message: null });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const adminData = await User.findOne({
            email: email,
            isAdmin: true
        }).select('email password isAdmin');

        if (!adminData) {
            return res.status(StatusCode.UNAUTHORIZED).render('admin-login', { message: 'Invalid Email' });
        }

        const passwordMatch = await bcrypt.compare(password, adminData.password);

        if (!passwordMatch) {
            return res.status(StatusCode.UNAUTHORIZED).render('admin-login', { message: 'Invalid Password' });
        }

        req.session.admin = {
            _id: adminData._id,
            email: adminData.email,
            isAdmin: adminData.isAdmin
        };

        req.session.save((err) => {
            if (err) {
                console.log('Session save error:', err);
                return res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/admin/login');
            }
            return res.status(StatusCode.REDIRECT).redirect('/admin/sales-report');
        });
    } catch (error) {
        console.log('Error in admin login:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/admin/pageError');
    }
};

const pageError = async (req, res) => {
    res.status(StatusCode.INTERNAL_SERVER_ERROR).render("errorPage");
}


const logout = async (req, res) => {
    try {
        req.session.admin = null;
        req.session.save((err) => {
            if (err) {
                console.log('Error saving session during logout:', err);
                return res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/admin/pageError');
            }
            res.status(StatusCode.REDIRECT).redirect('/admin/login');
        });
    } catch (error) {
        console.log('Unexpected error during logout:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).redirect('/admin/pageError');
    }
};
module.exports = {

    loadLogin,
    login,
    pageError,
    logout
}