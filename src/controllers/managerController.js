const db = require('../../database');

exports.getDashboard = async (req, res) => {
    try {
        const stats = {};

        // Count Students
        stats.studentCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM students', (e, r) => resolve(r ? r.c : 0)));

        // Count Teachers
        stats.teacherCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM users WHERE role = "teacher"', (e, r) => resolve(r ? r.c : 0)));

        // Count Requests Pending
        stats.requestCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Pending"', (e, r) => resolve(r ? r.c : 0)));

        // Count Classrooms
        stats.classCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM classrooms', (e, r) => resolve(r ? r.c : 0)));

        // Request stats
        stats.requestPendingCount = stats.requestCount;
        stats.requestApprovedCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Approved"', (e, r) => resolve(r ? r.c : 0)));
        stats.requestRejectedCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Rejected"', (e, r) => resolve(r ? r.c : 0)));
        stats.requestTotalCount = await new Promise((resolve) => db.get('SELECT COUNT(*) as c FROM requests', (e, r) => resolve(r ? r.c : 0)));

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

        // All requests (for history table)
        const allRequests = await new Promise((resolve) => {
            db.all(`
                SELECT r.*, u.full_name as sender_name, u.role as sender_role
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.date DESC
            `, (err, rows) => resolve(rows || []));
        });

        res.render('manager/dashboard', { stats, allRequests });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};
