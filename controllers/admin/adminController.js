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
        const email = req.body.email;
        const password = req.body.password;

        const adminData = await User.findOne({ email: email, isAdmin: true });

        if (adminData) {
            const passwordMatch = await bcrypt.compare(password, adminData.password);
            
            if (passwordMatch) {
          
                req.session.admin = {
                    _id: adminData._id,
                    email: adminData.email,
                    isAdmin: true
                };
                
              
                req.session.save((err) => {
                    if (err) {
                        console.log('Session save error:', err);
                        return res.redirect('/admin/login');
                    }
                    return res.redirect('/admin/'); 
                });
            } else {
                return res.render('admin-login', { message: 'Invalid Password' });
            }
        } else {
            return res.render('admin-login', { message: 'Invalid Email' });
        }
    } catch (error) {
        console.log('Error in admin login:', error);
        return res.redirect('/admin/pageError');
    }
};
const loadDashboard = async (req,res) => {

    if(req.session.admin){

        try {
            
            res.render('admin-dashboard');
        } catch (error) {

            res.redirect('/pageError')
            
        }
    }
}

const pageError = async (req,res) => {

    res.render("errorPage")
}

const logout = async (req,res) => {

    try {
        
        req.session.destroy(err => {
            if(err){
                console.log('error destroying session',err)
                return res.redirect('/admin/pageError')
            }

            res.redirect('/admin/login')
        })
    } catch (error) {

        console.log('unexcpected error during logout',error);
        res.redirect('/admin/pageError');
    }
}
module.exports = {

    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout
}