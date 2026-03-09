const express = require('express');
const router = express.Router();
const db = require('../../database');

router.get('/login', (req, res) => {
    db.all('SELECT username, password, role, full_name FROM users ORDER BY role, id', [], (err, rows) => {
        const demoUsers = rows || [];
        res.render('auth/login', { error: null, user: null, demoUsers });
    });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.render('auth/login', { error: 'System Error', user: null });
        }
        if (!row) {
            return res.render('auth/login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', user: null });
        }

        req.session.user = row;
        // Redirect based on role
        if (row.role === 'executive') return res.redirect('/executive/dashboard');
        res.redirect(`/${row.role}/dashboard`);
    });
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
