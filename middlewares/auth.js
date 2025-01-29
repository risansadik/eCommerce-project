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
        // If no user in session, allow access (public routes)
        if (!req.session.user) {
            return next();
        }

        // Check if user is blocked
        const currentUser = await User.findById(req.session.user);

        // If user not found or is blocked
        if (!currentUser || currentUser.isBlocked) {
            // Only clear user session data, preserve admin session
            req.session.user = null;
            
            // Save the modified session instead of destroying it
            await new Promise((resolve) => {
                req.session.save((err) => {
                    if (err) console.log('Session save error:', err);
                    resolve();
                });
            });

            // Redirect based on block status
            if (currentUser && currentUser.isBlocked) {
                return res.redirect('/signin?blocked=true');
            }
            return res.redirect('/signin?error=true');
        }

        // User exists and is not blocked, proceed
        next();
    } catch (error) {
        console.log('BlockAuth error:', error);
        return res.redirect('/signin?error=true');
    }
};

const redirectIfAuthenticated = async (req, res, next) => {
    try {
        // If user is already logged in
        if (req.session.user) {
            // Verify if the user exists and is not blocked
            const user = await User.findById(req.session.user);
            if (user && !user.isBlocked) {
                return res.redirect('/'); // Redirect to home page
            }
            
            // If user doesn't exist or is blocked, clear the session
            req.session.user = null;
            await new Promise((resolve) => {
                req.session.save((err) => {
                    if (err) console.log('Session save error:', err);
                    resolve();
                });
            });
        }
        
        // If no valid session exists, proceed to signin/signup page
        next();
    } catch (error) {
        console.log('RedirectIfAuthenticated error:', error);
        next(); // Proceed to signin/signup page in case of error
    }
};

module.exports = {
    userAuth,
    adminAuth,
    blockAuth,
    redirectIfAuthenticated
};