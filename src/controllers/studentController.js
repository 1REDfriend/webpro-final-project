const db = require('../../database');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');

const getStudentData = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT s.*, c.name as classroom_name, u.full_name as name, u.profile_pic
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN classrooms c ON s.classroom_id = c.id
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

            // Calculate GPA (Simplified for demonstration)
            let totalCredits = 0;
            let totalPoints = 0;
            grades.forEach(g => {
                let points = 0;
                if (g.grade_char === 'A') points = 4;
                else if (g.grade_char === 'B') points = 3;
                else if (g.grade_char === 'C') points = 2;
                else if (g.grade_char === 'D') points = 1;
                else points = 0;

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
        db.all(`
            SELECT sch.*, s.code, s.name, u.full_name as teacher_name
            FROM schedules sch
            JOIN subjects s ON sch.subject_id = s.id
            LEFT JOIN users u ON s.teacher_id = u.id
            WHERE sch.classroom_id = ?
            ORDER BY sch.day, sch.time_slot
        `, [student.classroom_id], (err, schedule) => {
            res.render('student/schedule', { student, schedule });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.getRequests = async (req, res) => {
    try {
        db.all('SELECT * FROM requests WHERE user_id = ? ORDER BY date DESC', [req.session.user.id], (err, requests) => {
            if (err) throw err;
            res.render('student/requests', { requests });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.postRequest = (req, res) => {
    const { topic, description } = req.body;
    db.run('INSERT INTO requests (user_id, topic, description) VALUES (?, ?, ?)',
        [req.session.user.id, topic, description], (err) => {
            if (err) console.error(err);
            res.redirect('/student/requests');
        });
};

exports.downloadTranscript = async (req, res) => {
    try {
        const student = await getStudentData(req.session.user.id);
        const grades = await new Promise((resolve, reject) => {
            db.all(`
                SELECT e.*, s.code, s.name, s.credit
                FROM enrollments e
                JOIN subjects s ON e.subject_id = s.id
                WHERE e.student_id = ?
            `, [student.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let totalCredits = 0;
        let totalPoints = 0;
        grades.forEach(g => {
            let points = 0;
            if (g.grade_char === 'A') points = 4;
            else if (g.grade_char === 'B') points = 3;
            else if (g.grade_char === 'C') points = 2;
            else if (g.grade_char === 'D') points = 1;

            totalPoints += points * g.credit;
            totalCredits += g.credit;
        });
        const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

        // Render template to HTML
        const templatePath = path.join(__dirname, '../../views/student/transcript-pdf.ejs');
        const html = await ejs.renderFile(templatePath, { student, grades, gpa });

        // Launch puppeteer to generate PDF
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        await browser.close();

        // Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=transcript_${student.student_code}.pdf`);
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating transcript PDF');
    }
};
