const db = require('../../database/db');

const getStudentData = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT s.*, c.name as class_name, u.name as name
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN classes c ON s.class_id = c.id
            WHERE u.id = ?
        `, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

exports.getDashboard = async (req, res) => {
    try {
        const student = await getStudentData(req.session.user.id);
        res.render('student/dashboard', { student });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.getGrades = async (req, res) => {
    try {
        const student = await getStudentData(req.session.user.id);
        db.all(`
            SELECT e.*, s.code, s.name, s.credit
            FROM enrollments e
            JOIN subjects s ON e.subject_id = s.id
            WHERE e.student_id = ?
        `, [student.id], (err, grades) => {
            if (err) throw err;

            // Calculate GPA
            let totalCredits = 0;
            let totalPoints = 0;
            grades.forEach(g => {
                const points = parseFloat(g.grade === 'F' ? 0 : g.grade);
                totalPoints += points * g.credit;
                totalCredits += g.credit;
            });
            const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0.00;

            res.render('student/grades', { student, grades, gpa });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.getSchedule = async (req, res) => {
    try {
        const student = await getStudentData(req.session.user.id);
        // Mock schedule - In a real app this would be more complex
        db.all(`
            SELECT s.code, s.name, t.user_id as teacher_user_id
            FROM enrollments e
            JOIN subjects s ON e.subject_id = s.id
            JOIN teachers t ON s.teacher_id = t.id
            WHERE e.student_id = ?
        `, [student.id], (err, subjects) => {
            // Fetch teacher names
            // Simplified for now, just render grid
            res.render('student/schedule', { student, subjects });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.getRequests = async (req, res) => {
    try {
        db.all('SELECT * FROM requests WHERE sender_id = ? ORDER BY created_at DESC', [req.session.user.id], (err, requests) => {
            if (err) throw err;
            res.render('student/requests', { requests });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.postRequest = (req, res) => {
    const { type, details } = req.body;
    db.run('INSERT INTO requests (sender_id, type, details) VALUES (?, ?, ?)',
        [req.session.user.id, type, details], (err) => {
            if (err) console.error(err);
            res.redirect('/student/requests');
        });
};
