const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || ""; // Default empty search
        let page = Number(req.query.page) || 1; // Ensure page is a number
        const limit = 4; // Number of users per page

        // Query users with search and pagination
        const data = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } },
            ],
        })
        .limit(limit)
        .skip((page - 1) * limit);

        // Get the total count of users matching the search criteria
        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } },
            ],
        }).countDocuments();

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        // If page exceeds total pages, redirect to last page
        if (page > totalPages) {
            page = totalPages;
        }

        // Pass the data, search query, page, limit, and count to the EJS template
        res.render('users', {
            data,
            search,
            page,
            totalPages, // Pass totalPages to the frontend
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
