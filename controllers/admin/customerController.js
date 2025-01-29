const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = 4;
        const search = req.query.search ? req.query.search.trim() : "";

   
        const searchQuery = {
            isAdmin: false,
            $or: [
                { name: { $regex: new RegExp(search, 'i') } },
                { email: { $regex: new RegExp(search, 'i') } },
                { phone: { $regex: new RegExp(search, 'i') } }
            ]
        };

     
        const data = await User.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit);

        const count = await User.countDocuments(searchQuery);
        const totalPages = Math.ceil(count / limit);


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

const customerBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect('/admin/users?blockSuccess=true');
    } catch (error) {
        res.redirect('/admin/pageError');
    }
};
const customerUnblocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
       
        res.redirect('/admin/users?unblockSuccess=true');
    } catch (error) {
        res.redirect('/admin/pageError');
    }
};

module.exports = { 
    customerInfo,
    customerBlocked,
    customerUnblocked
 };
