const express = require('express');
const app = express();
const path = require('path');
const env = require('dotenv').config();
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db');
const nocache = require('nocache');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const {StatusCode} = require('./config/statusCodes')



db();

app.use(nocache());

app.use(express.json());

app.use((req, res, next) => {

    if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.renderJSON = res.json;  
        res.json = function(data) {
            res.set('Content-Type', 'application/json');
            return res.renderJSON(data);
        };
    }
    next();
});
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use((req, res, next) => {
    if (!req.session) {
        return next(new Error('Session initialization failed'));
    }
    next();
});






app.use(passport.initialize());
app.use(passport.session());



app.use((req, res, next) => {
    res.locals.user = req.user || null; 
    next();
});


app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(StatusCode.INTERNAL_SERVER_ERROR).send('Something broke!');
});

app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')));




app.use('/',userRouter);
app.use('/admin',adminRouter);





const PORT = process.env.PORT || 3000;
app.listen(PORT,() => console.log('server is running'));