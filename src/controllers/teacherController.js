const db = require('../../database');
const fs = require('fs');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');

const getTeacherData = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM users WHERE id = ?
        `, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const processGrades = (grades) => {
    const groupedGrades = {};
    let totalCredits = 0;
    let totalPoints = 0;

    grades.forEach(g => {
        const levelCode = g.code ? g.code.substring(1, 3) : '';
        let level = 'ม.1';
        if (levelCode === '21') level = 'ม.1';
        else if (levelCode === '22') level = 'ม.2';
        else if (levelCode === '23') level = 'ม.3';
        else if (levelCode === '31') level = 'ม.4';
        else if (levelCode === '32') level = 'ม.5';
        else if (levelCode === '33') level = 'ม.6';
        g.grade_level = level;

        const lastDigit = g.code ? g.code.slice(-1) : '1';
        let semester = (parseInt(lastDigit) % 2 === 0) ? '2' : '1';
        g.semester = semester;

        let points = 0;
        if (g.grade_char === 'A') points = 4.0;
        else if (g.grade_char === 'B+') points = 3.5;
        else if (g.grade_char === 'B') points = 3.0;
        else if (g.grade_char === 'C+') points = 2.5;
        else if (g.grade_char === 'C') points = 2.0;
        else if (g.grade_char === 'D+') points = 1.5;
        else if (g.grade_char === 'D') points = 1.0;
        else points = 0;

        totalPoints += points * g.credit;
        totalCredits += g.credit;

        const groupKey = `${level}-${semester}`;
        if (!groupedGrades[groupKey]) {
            groupedGrades[groupKey] = {
                level: level,
                semester: semester,
                grades: [],
                totalCredits: 0,
                totalPoints: 0
            };
        }

        groupedGrades[groupKey].grades.push(g);
        groupedGrades[groupKey].totalCredits += g.credit;
        groupedGrades[groupKey].totalPoints += points * g.credit;
    });

    const groups = Object.values(groupedGrades).map(group => {
        group.gpa = group.totalCredits > 0 ? (group.totalPoints / group.totalCredits).toFixed(2) : '0.00';
        return group;
    });

    groups.sort((a, b) => {
        const levelA = parseInt(a.level.replace('ม.', '')) || 0;
        const levelB = parseInt(b.level.replace('ม.', '')) || 0;
        if (levelA !== levelB) return levelA - levelB;
        return parseInt(a.semester) - parseInt(b.semester);
    });

    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

    return { groups, gpa };
};

exports.getDashboard = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);
        db.all(`SELECT * FROM subjects WHERE teacher_id = ?`, [teacher.id], (err, subjects) => {
            if (err) throw err;
            db.all(`SELECT * FROM classrooms ORDER BY name`, [], (err, classrooms) => {
                if (err) throw err;
                let homeroom = null;
                if (teacher.homeroom_classroom_id) {
                    const room = classrooms.find(c => c.id === teacher.homeroom_classroom_id);
                    homeroom = room ? room.name : null;
                }
                db.all(`SELECT * FROM announcements WHERE target_audience IN ('both', 'teacher') ORDER BY created_at DESC LIMIT 3`, [], (err, announcements) => {
                    res.render('teacher/dashboard', { teacher, subjects, classrooms, homeroom, announcements: announcements || [] });
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.addSubject = (req, res) => {
    const { code, name, credit } = req.body;
    db.run(`INSERT INTO subjects (code, name, credit, teacher_id) VALUES (?, ?, ?, ?)`,
        [code, name, credit, req.session.user.id], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            res.redirect('/teacher/dashboard');
        });
};

exports.selectHomeroom = (req, res) => {
    const { classroom_id } = req.body;
    db.run(`UPDATE users SET homeroom_classroom_id = ? WHERE id = ?`,
        [classroom_id, req.session.user.id], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            res.redirect('/teacher/dashboard');
        });
};

exports.getClasses = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);

        // Fetch subjects taught by this teacher
        db.all(`SELECT * FROM subjects WHERE teacher_id = ?`, [teacher.id], (err, subjects) => {
            if (err) throw err;

            // Fetch list of all classrooms for the filter dropdown
            db.all(`SELECT * FROM classrooms ORDER BY name`, [], (err, classrooms) => {
                if (err) throw err;

                const classroom_id = req.query.classroom_id;
                const subject_id = req.query.subject_id;

                let query = `
                    SELECT s.*, u.full_name as name, c.name as classroom_name
                    FROM students s
                    JOIN users u ON s.user_id = u.id
                    JOIN classrooms c ON s.classroom_id = c.id
                    WHERE 1=1
                `;
                let params = [];

                if (classroom_id) {
                    query += ` AND s.classroom_id = ?`;
                    params.push(classroom_id);
                }

                if (subject_id) {
                    query += ` AND s.id IN (SELECT student_id FROM enrollments WHERE subject_id = ?)`;
                    params.push(subject_id);
                }

                query += ` ORDER BY c.name, s.student_code`;

                db.all(query, params, (err, students) => {
                    if (err) throw err;

                    // Fetch all grades for these students to calculate GPA
                    if (students.length === 0) {
                        return res.render('teacher/classes', { teacher, subjects, classrooms, students, filters: { classroom_id, subject_id } });
                    }

                    const studentIds = students.map(s => s.id);
                    const placeholders = studentIds.map(() => '?').join(',');
                    db.all(`
                        SELECT e.*, sub.code, sub.name, sub.credit
                        FROM enrollments e
                        JOIN subjects sub ON e.subject_id = sub.id
                        WHERE e.student_id IN (${placeholders})
                    `, studentIds, (err, allGrades) => {
                        if (err) throw err;

                        students.forEach(student => {
                            const studentGrades = allGrades.filter(g => g.student_id === student.id);
                            const processedData = processGrades(studentGrades);
                            student.gpa = processedData.gpa;
                        });

                        res.render('teacher/classes', { teacher, subjects, classrooms, students, filters: { classroom_id, subject_id } });
                    });
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.updateBehavior = (req, res) => {
    const { student_id, score_change, reason } = req.body;
    db.run(`UPDATE students SET behavior_score = MIN(100, MAX(0, behavior_score + ?)) WHERE id = ?`,
        [score_change, student_id], (err) => {
            if (err) console.error(err);
            else {
                // Log the behavior change
                db.run(`INSERT INTO behavior_logs (student_id, score_change, reason, recorded_by) VALUES (?, ?, ?, ?)`,
                    [student_id, score_change, reason || 'ไม่ระบุเหตุผล', req.session.user.id]);
            }
            res.redirect('/teacher/classes');
        });
};

exports.updateGrade = (req, res) => {
    const { student_id, subject_id, grade_midterm, grade_final } = req.body;
    const total = parseFloat(grade_midterm) + parseFloat(grade_final);
    let grade_char = 'F';
    if (total >= 80) grade_char = 'A';
    else if (total >= 70) grade_char = 'B';
    else if (total >= 60) grade_char = 'C';
    else if (total >= 50) grade_char = 'D';

    // Check if enrollment exists
    db.get('SELECT * FROM enrollments WHERE student_id = ? AND subject_id = ?', [student_id, subject_id], (err, row) => {
        if (row) {
            db.run(`UPDATE enrollments SET grade_midterm = ?, grade_final = ?, total_score = ?, grade_char = ? WHERE student_id = ? AND subject_id = ?`,
                [grade_midterm, grade_final, total, grade_char, student_id, subject_id], (err) => {
                    if (err) console.error(err);
                    res.redirect('/teacher/classes');
                });
        } else {
            db.run(`INSERT INTO enrollments (student_id, subject_id, grade_midterm, grade_final, total_score, grade_char) VALUES (?, ?, ?, ?, ?, ?)`,
                [student_id, subject_id, grade_midterm, grade_final, total, grade_char], (err) => {
                    if (err) console.error(err);
                    res.redirect('/teacher/classes');
                });
        }
    });
};

exports.getSchedule = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);
        // Get all classrooms where this teacher teaches subjects
        const schedule = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sch.*, s.code, s.name, c.name as classroom_name, c.id as classroom_id
                FROM schedules sch
                JOIN subjects s ON sch.subject_id = s.id
                JOIN classrooms c ON sch.classroom_id = c.id
                WHERE s.teacher_id = ?
                ORDER BY sch.day, sch.time_slot
            `, [teacher.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        // Also get homeroom schedule
        const homeroomSchedule = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sch.*, s.code, s.name, c.name as classroom_name, c.id as classroom_id, u.full_name as teacher_name
                FROM schedules sch
                JOIN subjects s ON sch.subject_id = s.id
                JOIN classrooms c ON sch.classroom_id = c.id
                LEFT JOIN users u ON s.teacher_id = u.id
                JOIN homeroom_teachers ht ON c.id = ht.classroom_id
                WHERE ht.teacher_id = ?
                ORDER BY c.name, sch.day, sch.time_slot
            `, [teacher.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get classrooms the teacher is homeroom for
        const homeroomClassrooms = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT c.id, c.name FROM classrooms c
                JOIN homeroom_teachers ht ON c.id = ht.classroom_id
                WHERE ht.teacher_id = ?
                ORDER BY c.name
            `, [teacher.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.render('teacher/schedule', { teacher, schedule, homeroomSchedule, homeroomClassrooms });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.getRequests = (req, res) => {
    db.all('SELECT * FROM requests WHERE user_id = ? ORDER BY date DESC', [req.session.user.id], (err, requests) => {
        if (err) throw err;
        // Show cancel button for all Pending requests; time check enforced on cancel endpoint
        const processedRequests = (requests || []).map(r => ({
            ...r,
            canCancel: r.status === 'Pending'
        }));
        res.render('teacher/requests', { requests: processedRequests });
    });
};

exports.cancelRequest = (req, res) => {
    const { request_id } = req.body;
    const userId = req.session.user.id;
    db.get('SELECT * FROM requests WHERE id = ? AND user_id = ?', [request_id, userId], (err, request) => {
        if (err || !request) return res.redirect('/teacher/requests');
        const now = Date.now();
        // SQLite CURRENT_TIMESTAMP is UTC; add 'Z' to parse as UTC (not local time)
        const dateStr = request.date ? request.date.replace(' ', 'T') + 'Z' : null;
        const elapsed = dateStr ? now - new Date(dateStr).getTime() : Infinity;
        if (request.status === 'Pending' && elapsed < 3600000) {
            db.run('DELETE FROM requests WHERE id = ? AND user_id = ?', [request_id, userId], (err) => {
                if (err) console.error(err);
                res.redirect('/teacher/requests');
            });
        } else {
            res.redirect('/teacher/requests');
            console.log('[DEBUG cancelReq]', {
                id: request_id,
                status: request.status,
                raw_date: request.date,
                dateStr,
                elapsed_ms: elapsed,
                canCancel: request.status === 'Pending' && elapsed < 3600000
            });
        }
    });
};

exports.getAllAnnouncements = (req, res) => {
    db.all(`SELECT * FROM announcements WHERE target_audience IN ('both', 'teacher') ORDER BY created_at DESC`, [], (err, announcements) => {
        if (err) announcements = [];
        res.render('teacher/announcements-all', { announcements: announcements || [] });
    });
};

exports.getAnnouncementDetail = (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM announcements WHERE id = ? AND target_audience IN ("both", "teacher")', [id], (err, announcement) => {
        if (err || !announcement) return res.status(404).render('teacher/announcement-detail', { announcement: null });
        res.render('teacher/announcement-detail', { announcement });
    });
};

exports.postRequest = (req, res) => {
    const { topic, description } = req.body;
    const attachmentUrl = req.file ? 'uploads/' + req.file.filename : null;
    db.run('INSERT INTO requests (user_id, topic, description, attachment_url) VALUES (?, ?, ?, ?)',
        [req.session.user.id, topic, description, attachmentUrl], (err) => {
            if (err) console.error(err);
            res.redirect('/teacher/requests');
        });
};

exports.getStudentGrades = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);
        const studentId = req.params.id;

        // Fetch student details
        db.get(`
            SELECT s.*, c.name as classroom_name, u.full_name as name, u.profile_pic
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN classrooms c ON s.classroom_id = c.id
            WHERE s.id = ?
        `, [studentId], (err, student) => {
            if (err) throw err;
            if (!student) return res.status(404).send('Student not found');

            // Fetch student grades
            db.all(`
                SELECT e.*, sub.code, sub.name, sub.credit
                FROM enrollments e
                JOIN subjects sub ON e.subject_id = sub.id
                WHERE e.student_id = ?
            `, [studentId], (err, grades) => {
                if (err) throw err;

                const processedData = processGrades(grades);
                res.render('teacher/student_grades', { teacher, student, groups: processedData.groups, gpa: processedData.gpa });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.downloadGradesCSV = async (req, res) => {
    try {
        const { classroom_id, subject_id, semester, academic_year } = req.query;
        if (!classroom_id || !subject_id) {
            return res.status(400).send('ต้องการห้องเรียนและวิชาเพื่อส่งออก CSV');
        }

        const sem = semester || '1';
        const yr = academic_year || '2567';
        // LEFT JOIN enrollments with specific subject+semester+year so grades always appear
        const query = `
            SELECT s.student_code, u.full_name as student_name,
                   e.grade_midterm, e.grade_final, e.total_score, e.grade_char
            FROM students s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN enrollments e ON s.id = e.student_id
                AND e.subject_id = ?
                AND (e.semester = ? OR e.semester IS NULL)
                AND (e.academic_year = ? OR e.academic_year IS NULL)
            WHERE s.classroom_id = ?
            ORDER BY s.student_code
        `;
        db.all(query, [subject_id, sem, yr, classroom_id], (err, records) => {
            if (err) throw err;
            const data = records.map(r => ({
                'รหัสนักเรียน': r.student_code,
                'ชื่อ-นามสกุล': r.student_name,
                'คะแนนสอบกลางภาค': r.grade_midterm !== null && r.grade_midterm !== undefined ? r.grade_midterm : '',
                'คะแนนสอบปลายภาค': r.grade_final !== null && r.grade_final !== undefined ? r.grade_final : '',
                'คะแนนรวม': r.total_score !== null && r.total_score !== undefined ? r.total_score : '',
                'เกรด': r.grade_char || ''
            }));
            const csvData = stringify(data, { header: true });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="grades.csv"');
            res.send('\uFEFF' + csvData);
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.uploadGradesCSV = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }
        const { subject_id, semester, academic_year } = req.body;
        if (!subject_id) {
            return res.status(400).send('Missing subject details.');
        }

        const records = [];
        fs.createReadStream(req.file.path)
            .pipe(parse({ columns: true, skip_empty_lines: true }))
            .on('data', (row) => {
                records.push(row);
            })
            .on('end', () => {
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    let pendingOps = records.length;

                    if (pendingOps === 0) {
                        db.run("COMMIT");
                        fs.unlinkSync(req.file.path);
                        return res.redirect('/teacher/classes');
                    }

                    records.forEach(r => {
                        const code = r['รหัสนักเรียน'];
                        const midterm = parseFloat(r['คะแนนสอบกลางภาค']) || 0;
                        const final = parseFloat(r['คะแนนสอบปลายภาค']) || 0;
                        const total = midterm + final;
                        let grade = 'F';
                        if (total >= 80) grade = 'A';
                        else if (total >= 75) grade = 'B+';
                        else if (total >= 70) grade = 'B';
                        else if (total >= 65) grade = 'C+';
                        else if (total >= 60) grade = 'C';
                        else if (total >= 55) grade = 'D+';
                        else if (total >= 50) grade = 'D';

                        // Find student ID
                        db.get(`SELECT id FROM students WHERE student_code = ?`, [code], (err, student) => {
                            if (!err && student) {
                                // Insert or replace
                                db.get('SELECT * FROM enrollments WHERE student_id = ? AND subject_id = ? AND academic_year = ? AND semester = ?',
                                    [student.id, subject_id, academic_year || '2567', semester || '1'], (err, row) => {

                                        // Record Grade Log
                                        db.run(`INSERT INTO grade_logs (student_id, subject_id, action, old_grade_midterm, new_grade_midterm, old_grade_final, new_grade_final, academic_year, semester, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                            [student.id, subject_id, row ? 'UPDATE_CSV' : 'INSERT_CSV', row ? row.grade_midterm : null, midterm, row ? row.grade_final : null, final, academic_year || '2567', semester || '1', req.session.user.id]);

                                        if (row) {
                                            db.run(`UPDATE enrollments SET grade_midterm = ?, grade_final = ?, total_score = ?, grade_char = ?, recorded_by = ?, recorded_at = CURRENT_TIMESTAMP WHERE student_id = ? AND subject_id = ? AND academic_year = ? AND semester = ?`,
                                                [midterm, final, total, grade, req.session.user.id, student.id, subject_id, academic_year || '2567', semester || '1'], checkComplete);
                                        } else {
                                            db.run(`INSERT INTO enrollments (student_id, subject_id, grade_midterm, grade_final, total_score, grade_char, academic_year, semester, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                                [student.id, subject_id, midterm, final, total, grade, academic_year || '2567', semester || '1', req.session.user.id], checkComplete);
                                        }
                                    });
                            } else {
                                checkComplete();
                            }
                        });

                        function checkComplete() {
                            pendingOps--;
                            if (pendingOps === 0) {
                                db.run("COMMIT");
                                fs.unlinkSync(req.file.path);
                                res.redirect('/teacher/classes');
                            }
                        }
                    });
                });
            });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};
