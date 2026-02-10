const db = require('./db');

const serialize = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            resolve();
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

async function seed() {
    console.log('Seeding data...');

    // Clear existing data
    await run("DELETE FROM requests");
    await run("DELETE FROM behaviors");
    await run("DELETE FROM enrollments");
    await run("DELETE FROM subjects");
    await run("DELETE FROM students");
    await run("DELETE FROM teachers");
    await run("DELETE FROM classes");
    await run("DELETE FROM users");

    // 1. Create Classes
    const classIds = [];
    const classes = ['M.1/1', 'M.1/2', 'M.1/3', 'M.2/1', 'M.2/2', 'M.2/3'];
    for (const cls of classes) {
        const res = await run("INSERT INTO classes (name, level) VALUES (?, ?)", [cls, parseInt(cls[2])]);
        classIds.push(res.lastID);
    }
    console.log('Classes created.');

    // 2. Create Admin, Staff, Manager
    await run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", ['admin', 'admin', 'admin', 'Admin User']);
    await run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", ['staff', 'staff', 'staff', 'Registrar Staff']);
    await run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", ['manager', 'manager', 'manager', 'School Manager']);
    console.log('Admin, Staff, Manager created.');

    // 3. Create Teachers (5 Teachers)
    const teachers = [
        { name: 'Teacher Somchai', dept: 'Math' },
        { name: 'Teacher Somsri', dept: 'English' },
        { name: 'Teacher Somsak', dept: 'Science' },
        { name: 'Teacher Somying', dept: 'Thai' },
        { name: 'Teacher Sompong', dept: 'Social Studies' }
    ];

    const teacherIds = [];
    for (const t of teachers) {
        const userRes = await run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", [`t_${t.name.split(' ')[1].toLowerCase()}`, 'password', 'teacher', t.name]);
        const teacherRes = await run("INSERT INTO teachers (user_id, department, homeroom_class_id) VALUES (?, ?, ?)", [userRes.lastID, t.dept, classIds[teacherIds.length % classIds.length]]);
        teacherIds.push(teacherRes.lastID);
    }
    console.log('Teachers created.');

    // 4. Create Subjects (30 Subjects)
    const subjects = [];
    for (let i = 1; i <= 30; i++) {
        subjects.push({
            code: `SUB${100 + i}`,
            name: `Subject ${i}`,
            credit: i % 2 === 0 ? 1.5 : 1.0,
            teacher_id: teacherIds[i % teacherIds.length]
        });
    }

    const subjectIds = [];
    for (const s of subjects) {
        const res = await run("INSERT INTO subjects (code, name, credit, teacher_id) VALUES (?, ?, ?, ?)", [s.code, s.name, s.credit, s.teacher_id]);
        subjectIds.push(res.lastID);
    }
    console.log('Subjects created.');

    // 5. Create Students (50+ Students)
    const firstNames = ['Somchai', 'Somsri', 'Somsak', 'Somying', 'Sompong', 'Malee', 'Mana', 'Piti', 'Chujai', 'Weera'];
    const lastNames = ['Jaidee', 'Rakthai', 'Deejai', 'Meewong', 'Ruckdee', 'Sookjai', 'Munjai', 'Kengmak', 'Deejung', 'Jingjai'];

    for (let i = 1; i <= 60; i++) {
        const fname = firstNames[i % firstNames.length];
        const lname = lastNames[i % lastNames.length] + i; // Append i to make unique
        const username = `std${1000 + i}`;

        const userRes = await run("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)", [username, 'password', 'student', `${fname} ${lname}`]);
        const classId = classIds[i % classIds.length];

        const stdRes = await run("INSERT INTO students (user_id, student_code, class_id) VALUES (?, ?, ?)", [userRes.lastID, username, classId]);
        const studentId = stdRes.lastID;

        // Enroll in random subjects
        for (let j = 0; j < 10; j++) {
            const subjId = subjectIds[(i + j) % subjectIds.length];
            // Random score 50-100
            const score = Math.floor(Math.random() * 51) + 50;
            let grade = 'F';
            if (score >= 80) grade = '4';
            else if (score >= 75) grade = '3.5';
            else if (score >= 70) grade = '3';
            else if (score >= 65) grade = '2.5';
            else if (score >= 60) grade = '2';
            else if (score >= 55) grade = '1.5';
            else if (score >= 50) grade = '1';

            await run("INSERT INTO enrollments (student_id, subject_id, score, grade, semester, year) VALUES (?, ?, ?, ?, ?, ?)",
                [studentId, subjId, score, grade, 1, 2024]);
        }

        // Add some behavior scores
        if (i % 3 === 0) {
            await run("INSERT INTO behaviors (student_id, score_change, reason, teacher_id) VALUES (?, ?, ?, ?)",
                [studentId, -5, 'Late to class', teacherIds[0]]);
        }
    }
    console.log('Students and enrollments created.');

}

seed().then(() => {
    console.log('Seeding complete.');
    db.close();
}).catch(err => {
    console.error('Seeding failed:', err);
});
