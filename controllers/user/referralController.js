const User = require('../../models/userSchema');

const getReferral = async (req,res) => {

    try {
        
        res.render('referral')
    } catch (error) {
        console.log('error loading refferal page : ',error);
    }
}

module.exports = {

    getReferral
}