const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const loadLogin = (req,res) => {

    if(req.session.admin){

        return res.redirect('/admin');
    }
    res.render("admin-login",{message:null});
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const adminData = await User.findOne({ 
            email: email, 
            isAdmin: true 
        }).select('email password isAdmin');

        if (!adminData) {
            return res.render('admin-login', { message: 'Invalid Email' });
        }

        const passwordMatch = await bcrypt.compare(password, adminData.password);
        
        if (!passwordMatch) {
            return res.render('admin-login', { message: 'Invalid Password' });
        }

       
        req.session.admin = {
            _id: adminData._id,
            email: adminData.email,
            isAdmin: adminData.isAdmin
        };

       
        req.session.save((err) => {
            if (err) {
                console.log('Session save error:', err);
                return res.redirect('/admin/login');
            }
            return res.redirect('/admin/sales-report');
        });

    } catch (error) {
        console.log('Error in admin login:', error);
        return res.redirect('/admin/pageError');
    }
};


const pageError = async (req,res) => {

    res.render("errorPage")
}

const logout = async (req, res) => {
    try {
       
        req.session.admin = null;
        req.session.save((err) => {
            if (err) {
                console.log('Error saving session during logout:', err);
                return res.redirect('/admin/pageError');
            }
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.log('Unexpected error during logout:', error);
        res.redirect('/admin/pageError');
    }
};
module.exports = {

    loadLogin,
    login,
    pageError,
    logout
}