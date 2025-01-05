const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const loadLogin = (req,res) => {

    if(req.session.admin){

        return res.redirect('/admin');
    }
    res.render("admin-login",{message:null});
}

const login = async (req,res) => {

    try {
        
        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password);
            if (passwordMatch){
                req.session.admin = true
                return res.redirect('/admin')
            }else{
                return res.render('admin-login',{message : "Incorrect password"})
            }
        }else{

            return res.render('admin-login',{message : 'Invalid credentials'});
        }

    } catch (error) {

        console.log('login error',error);
        return res.redirect('/pageError');
        
    }
}

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