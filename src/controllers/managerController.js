const db = require('../../database/db');

exports.getDashboard = async (req, res) => {
    try {
        const stats = {};

        // Count Students
        const students = await new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM students', (err, row) => resolve(row.count)));
        stats.studentCount = students;

        // Count Teachers
        const teachers = await new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM teachers', (err, row) => resolve(row.count)));
        stats.teacherCount = teachers;

        // Count Requests
        const requests = await new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM requests', (err, row) => resolve(row.count)));
        stats.requestCount = requests;

        // Count Classes
        const classes = await new Promise((resolve) => db.get('SELECT COUNT(*) as count FROM classes', (err, row) => resolve(row.count)));
        stats.classCount = classes;

        // Average GPA Calculation (Simplified)
        const avgGpa = await new Promise((resolve) => {
            db.all('SELECT grade, credit FROM enrollments WHERE grade != "F"', (err, rows) => {
                if (err || rows.length === 0) return resolve(0);
                let totalPoints = 0;
                let totalCredits = 0;
                rows.forEach(r => {
                    totalPoints += parseFloat(r.grade) * r.credit;
                    totalCredits += r.credit;
                });
                resolve(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0);
            });
        });
        stats.avgGpa = avgGpa;

        res.render('manager/dashboard', { stats });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};
