const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'kstudent.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database (KStudent).');
    }
});

db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('student', 'teacher', 'staff', 'executive')) NOT NULL,
        full_name TEXT NOT NULL,
        profile_pic TEXT DEFAULT 'default.png',
        homeroom_classroom_id INTEGER
    )`);

    db.run(`ALTER TABLE users ADD COLUMN homeroom_classroom_id INTEGER`, (err) => {
        // Ignore error if column already exists
    });

    // 2. Classrooms Table
    db.run(`CREATE TABLE IF NOT EXISTS classrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL -- e.g., 'M.1/1'
    )`);

    // 3. Students Table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        classroom_id INTEGER,
        student_code TEXT UNIQUE,
        behavior_score INTEGER DEFAULT 100,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id)
    )`);

    // 4. Subjects Table
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        credit REAL NOT NULL,
        teacher_id INTEGER, -- Links to a user with role 'teacher'
        FOREIGN KEY(teacher_id) REFERENCES users(id)
    )`);

    // 5. Enrollments Table (Grades)
    db.run(`CREATE TABLE IF NOT EXISTS enrollments (
        student_id INTEGER,
        subject_id INTEGER,
        grade_midterm REAL DEFAULT 0,
        grade_final REAL DEFAULT 0,
        total_score REAL DEFAULT 0,
        grade_char TEXT, -- A, B+, etc.
        PRIMARY KEY (student_id, subject_id),
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(subject_id) REFERENCES subjects(id)
    )`);

    // 6. Requests Table
    db.run(`CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        topic TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected')),
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        reply TEXT, -- Staff/Teacher reply
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 7. Schedules Table
    db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classroom_id INTEGER,
        subject_id INTEGER,
        day TEXT CHECK(day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
        time_slot TEXT, -- e.g., '08:00-09:00'
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id),
        FOREIGN KEY(subject_id) REFERENCES subjects(id)
    )`);
});

module.exports = db;
