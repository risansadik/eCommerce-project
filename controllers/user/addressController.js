const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');

const getAddAddressPage = async (req, res) => {

    try {

        res.render('add-address');

    } catch (error) {

        console.log('error during loading address page', error);

    }
}



const addAddress = async (req, res) => {
    try {
        console.log('Session:', req.session);
        console.log('User ID from session:', req.session.user);
        console.log('Form data received:', req.body);
        
        const userId = req.session.user;
        
        const addressData = {
            addressType: req.body.addressType,
            name: req.body.name,
            city: req.body.city,
            landmark: req.body.landmark,
            state: req.body.state,
            pincode: req.body.pincode,
            phone: req.body.phone,
            altPhone: req.body.altPhone
        };

        let userAddress = await Address.findOne({ userId: userId });

        if (userAddress) {
            console.log('Existing user address found, adding new address');
            userAddress.address.push(addressData);
            await userAddress.save();
        } else {
            console.log('Creating new user address document');
            userAddress = new Address({
                userId: userId,
                address: [addressData]
            });
            await userAddress.save();
        }

        console.log('Address saved successfully');
        return res.redirect('/addresses');
        
    } catch (error) {
        console.log('Error adding address:', error);
        return res.status(500).render('add-address', { error: 'Failed to add address' });
    }
};

const loadAddresses = async (req, res) => {
    try {
        console.log('Loading addresses for user:', req.session.user);
        const userId = req.session.user;
        const addressData = await Address.findOne({ userId: userId });
        
        console.log('Found address data:', addressData);

        res.render('addresses', {
            addresses: addressData ? addressData.address : [],
            user: req.session.user
        });
    } catch (error) {
        console.log('Error loading addresses:', error);
        res.status(500).render('addresses', { 
            error: 'Failed to load addresses',
            addresses: []
        });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressIndex = parseInt(req.params.index);

        // Input validation
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (isNaN(addressIndex) || addressIndex < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address index'
            });
        }

        // Find the user's address document
        const userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        if (!userAddress.address || addressIndex >= userAddress.address.length) {
            return res.status(404).json({
                success: false,
                message: 'Address not found at specified index'
            });
        }

        // Remove the address and save
        userAddress.address.splice(addressIndex, 1);
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        console.error('Delete address error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
module.exports = {

   
    getAddAddressPage,
    addAddress,
    loadAddresses,
    deleteAddress
}