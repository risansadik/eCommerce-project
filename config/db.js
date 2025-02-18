const mongoose = require('mongoose');
const env = require('dotenv');

env.config();

const connectDB = async () =>{
    try {
        
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDb connected');

	console.log(`databse host name ${conn.connection.host}`)
	console.log(`database name is: ${conn.connection.name}`)

        

    } catch (error) {

        console.log('DB connection error',error.message);
        process.exit(1);
    }
}

module.exports = connectDB;
