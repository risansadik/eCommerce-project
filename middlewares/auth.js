const User = require('../models/userSchema');

const userAuth = (req, res, next) => {
    if(req.session.user){
        User.findById(req.session.user)
        .then(data => {
            if(data && !data.isBlocked){
                req.user = data;
                next();
            } else {
                res.redirect('/signin')
            }
        }).catch(error => {
            console.log('Error in user auth middleware', error)
            res.status(500).send("internal server error")
        })
    } else {
        res.redirect('/signin');
    }
}

const adminAuth = (req, res, next) => {
    try {
        
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }

        
        User.findOne({ _id: req.session.admin._id, isAdmin: true })
            .then(admin => {
                if (!admin) {
                    
                    req.session.destroy(err => {
                        if (err) {
                            console.log('Error destroying session:', err);
                        }
                        return res.redirect('/admin/login');
                    });
                } else {
                   
                    next();
                }
            })
            .catch(error => {
                console.log('Error in adminAuth middleware:', error);
                req.session.destroy(err => {
                    if (err) {
                        console.log('Error destroying session:', err);
                    }
                    return res.redirect('/admin/login');
                });
            });
    } catch (error) {
        console.log('Unexpected error in adminAuth:', error);
        return res.redirect('/admin/login');
    }
};

const blockAuth =  async (req,res,next)=> {

    const blockedUser = await User.findOne({isBlocked:true});

    if(req.session.user && blockedUser){

        res.redirect('/signin');
        req.session.destroy(err => {

            console.log(err);
        })
    }else{

        next();
    }
}


module.exports = {

    userAuth,
    adminAuth,
    blockAuth
}