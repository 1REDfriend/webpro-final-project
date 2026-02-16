const db = require('../../database');

exports.getDashboard = async (req, res) => {
    try {
        const stats = {};

        // Count Students
        stats.studentCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM students', (e, r) => resolve(r.c)));

        // Count Teachers
        stats.teacherCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM users WHERE role = "teacher"', (e, r) => resolve(r.c)));

        // Count Requests Pending
        stats.requestCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Pending"', (e, r) => resolve(r.c)));

        // Count Classrooms
        stats.classCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM classrooms', (e, r) => resolve(r.c)));

        // Average GPA Calculation
        const avgGpa = await new Promise((resolve) => {
            db.all('SELECT total_score, credit FROM enrollments e JOIN subjects s ON e.subject_id = s.id', (err, rows) => {
                if (err || rows.length === 0) return resolve(0);
                let totalPoints = 0;
                let totalCredits = 0;
                rows.forEach(r => {
                    let points = 0;
                    if (r.total_score >= 80) points = 4;
                    else if (r.total_score >= 70) points = 3;
                    else if (r.total_score >= 60) points = 2;
                    else if (r.total_score >= 50) points = 1;

                    totalPoints += points * r.credit;
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
