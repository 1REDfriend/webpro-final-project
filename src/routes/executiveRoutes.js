const express = require('express');
const router = express.Router();
const executiveController = require('../controllers/executiveController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(isAuthenticated, hasRole('executive'));

router.get('/dashboard', executiveController.getDashboard);

// Teacher Management Routes
router.get('/teachers', executiveController.getTeachers);
router.post('/teachers', executiveController.addTeacher);
router.post('/teachers/delete', executiveController.deleteTeacher);
router.get('/teachers/:id/edit', executiveController.getEditTeacher);
router.post('/teachers/:id/edit', upload.single('profile_pic_file'), executiveController.updateTeacher);
router.post('/teachers/:id/subjects/assign', executiveController.assignSubjectToTeacher);
router.post('/teachers/:id/subjects/unassign', executiveController.unassignSubjectFromTeacher);
router.post('/teachers/:id/homeroom/assign', executiveController.assignHomeroomToTeacher);
router.post('/teachers/:id/homeroom/unassign', executiveController.unassignHomeroomFromTeacher);

// Student Management Routes
router.get('/students', executiveController.getStudents);
router.post('/students', executiveController.addStudent);
router.post('/students/delete', executiveController.deleteStudent);

// Edit Student
router.get('/students/:student_id/edit', executiveController.getEditStudent);
router.post('/students/:student_id/edit', upload.single('profile_pic_file'), executiveController.updateStudent);

// Manage Student details
router.get('/students/:student_id/manage', executiveController.getManageStudent);
router.post('/students/:student_id/manage/classroom', executiveController.updateStudentClassroom);
router.post('/students/:student_id/manage/subjects/add', executiveController.addSubjectToStudent);
router.post('/students/:student_id/manage/subjects/remove', executiveController.removeSubjectFromStudent);

module.exports = router;
