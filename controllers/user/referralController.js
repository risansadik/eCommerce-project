const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema')


const getReferral = async (req, res) => {
        try {
            const user = await User.findById(req.user._id);
            const wallet = await Wallet.findOne({ userId: req.user._id });

            res.render('referral', {
                referralCode: user.referalCode,
                referralCount: user.referralCount,
                wallet: wallet ? wallet.balance : 0
            });
        } catch (error) {
            console.log('Error loading referral page:', error);
            res.status(500).send('Internal Server Error');
        }
    }

module.exports = {

   getReferral
}