const mongoose = require('mongoose');
const env = require('dotenv');

env.config();

const connectDB = async () =>{
    try {
        
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDb connected');
        console.log(`Host: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.name}`); 
        console.log('MongoDB URI:', process.env.MONGODB_URI);


    } catch (error) {

        console.log('DB connection error',error.message);
        process.exit(1);
    }
}

module.exports = connectDB;