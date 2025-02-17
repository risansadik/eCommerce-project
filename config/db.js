const mongoose = require('mongoose');
const env = require('dotenv');

env.config();

const connectDB = async () =>{
    try {
        
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDb connected');
<<<<<<< HEAD
	console.log(`databse host name ${conn.connection.host}`)
	console.log(`database name is: ${conn.connection.name}`)
=======
        

>>>>>>> 336a036ddc5595da46491801d5e74daa5d8fac39

    } catch (error) {

        console.log('DB connection error',error.message);
        process.exit(1);
    }
}

module.exports = connectDB;
