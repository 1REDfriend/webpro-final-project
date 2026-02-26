const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: 'kstudent-secret-key-2024',
    resave: false,
    saveUninitialized: true
}));

// Global User Middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database
const db = require('./database');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const staffRoutes = require('./src/routes/staffRoutes');
const managerRoutes = require('./src/routes/managerRoutes');
const executiveRoutes = require('./src/routes/executiveRoutes');

app.use('/', authRoutes);
app.use('/student', studentRoutes);
app.use('/teacher', teacherRoutes);
app.use('/staff', staffRoutes);
app.use('/sys-admin', managerRoutes); // sys-admin maps to manager
app.use('/executive', executiveRoutes); // Proper executive routes

// Root Redirect
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(`/${req.session.user.role}/dashboard`);
    }
    res.redirect('/login');
});

app.listen(port, () => {
    console.log(`KStudent Server running on http://localhost:${port}`);
});
