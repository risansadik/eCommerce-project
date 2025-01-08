const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = 4;
        const search = req.query.search ? req.query.search.trim() : "";

        // Case-insensitive search query
        const searchQuery = {
            isAdmin: false,
            $or: [
                { name: { $regex: new RegExp(search, 'i') } },
                { email: { $regex: new RegExp(search, 'i') } },
                { phone: { $regex: new RegExp(search, 'i') } }
            ]
        };

        // Get users with search and pagination
        const data = await User.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit);

        // Get total count for pagination
        const count = await User.countDocuments(searchQuery);
        const totalPages = Math.ceil(count / limit);

        // If page exceeds total pages, redirect to last page
        if (page > totalPages && totalPages > 0) {
            return res.redirect(`/admin/users?page=${totalPages}&search=${search}`);
        }

        res.render('users', {
            data,
            search,
            page,
            totalPages,
            count
        });
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).send('Server error');
    }
};

const customerBlocked = async (req,res) => {

    try {
        
        let id = req.query.id;
        await User.updateOne({_id : id},{$set : {isBlocked : true}});
        res.redirect('/admin/users')
    } catch (error) {

        res.redirect('/admin/pageError');
        
    }
}

const customerUnblocked = async (req,res) => {

    try {
        let id = req.query.id;
        await User.updateOne({_id : id},{$set : {isBlocked:false}});
        res.redirect('/admin/users')

    } catch (error) {

        res.redirect('/admin/pageError')
        
    }
}

module.exports = { 
    customerInfo,
    customerBlocked,
    customerUnblocked
 };
