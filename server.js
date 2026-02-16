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

app.use('/', authRoutes);
app.use('/student', studentRoutes);
app.use('/teacher', teacherRoutes);
app.use('/staff', staffRoutes);
app.use('/sys-admin', managerRoutes); // Mapping manager/executive to sys-admin route or similar

// Alias executive to manager controller for now, or update manager routes to be executive
app.use('/executive', managerRoutes);

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
