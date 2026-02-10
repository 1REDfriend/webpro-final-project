const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-key', // Change in production
    resave: false,
    saveUninitialized: true
}));

// Make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database Setup (Will be imported)
const db = require('./database/db');

// Component Routes
const authRoutes = require('./src/routes/authRoutes');
app.use('/', authRoutes);

const studentRoutes = require('./src/routes/studentRoutes');
app.use('/student', studentRoutes);

const teacherRoutes = require('./src/routes/teacherRoutes');
app.use('/teacher', teacherRoutes);

const staffRoutes = require('./src/routes/staffRoutes');
app.use('/staff', staffRoutes);

const managerRoutes = require('./src/routes/managerRoutes');
app.use('/manager', managerRoutes);

// Default Route
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { error: null });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
