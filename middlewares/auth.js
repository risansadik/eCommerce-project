const User = require('../models/userSchema');

const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    req.user = data;
                    next();
                } else {
                    req.session.user = null;
                    req.session.save((err) => {
                        if (err) console.log('Session save error:', err);
                        res.redirect('/signin');
                    });
                }
            }).catch(error => {
                console.log('Error in user auth middleware', error);
                res.status(500).send("internal server error");
            });
    } else {
        res.redirect('/signin');
    }
};

const adminAuth = async (req, res, next) => {
    try {
        if (!req.session || !req.session.admin || !req.session.admin._id) {
            return res.redirect('/admin/login');
        }

        const admin = await User.findOne({
            _id: req.session.admin._id,
            isAdmin: true
        }).select('email isAdmin');

        if (!admin) {
            req.session.admin = null;
            return res.redirect('/admin/login');
        }

        req.session.admin = {
            _id: admin._id,
            email: admin.email,
            isAdmin: admin.isAdmin
        };

        req.session.save((err) => {
            if (err) {
                console.log('Session save error in adminAuth:', err);
                return res.redirect('/admin/login');
            }
            next();
        });

    } catch (error) {
        console.log('Unexpected error in adminAuth:', error);
        req.session.admin = null;
        return res.redirect('/admin/login');
    }
};

const blockAuth = async (req, res, next) => {
    try {
      
        if (!req.session.user) {
            return next();
        }

        
        const currentUser = await User.findById(req.session.user);

       
        if (!currentUser || currentUser.isBlocked) {
           
            req.session.user = null;
            
           
            await new Promise((resolve) => {
                req.session.save((err) => {
                    if (err) console.log('Session save error:', err);
                    resolve();
                });
            });

            
            if (currentUser && currentUser.isBlocked) {
                return res.redirect('/signin?blocked=true');
            }
            return res.redirect('/signin?error=true');
        }

      
        next();
    } catch (error) {
        console.log('BlockAuth error:', error);
        return res.redirect('/signin?error=true');
    }
};

const redirectIfAuthenticated = async (req, res, next) => {
    try {
       
        if (req.session.user) {
          
            const user = await User.findById(req.session.user);
            if (user && !user.isBlocked) {
                return res.redirect('/'); 
            }
            
           
            req.session.user = null;
            await new Promise((resolve) => {
                req.session.save((err) => {
                    if (err) console.log('Session save error:', err);
                    resolve();
                });
            });
        }
        
     
        next();
    } catch (error) {
        console.log('RedirectIfAuthenticated error:', error);
        next(); 
    }
};

module.exports = {
    userAuth,
    adminAuth,
    blockAuth,
    redirectIfAuthenticated
};