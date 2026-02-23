const express = require('express');
const router = express.Router();
const executiveController = require('../controllers/executiveController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('executive'));

router.get('/dashboard', executiveController.getDashboard);

// Teacher Management Routes
router.get('/teachers', executiveController.getTeachers);
router.post('/teachers', executiveController.addTeacher);
router.post('/teachers/delete', executiveController.deleteTeacher);
router.get('/teachers/:id/edit', executiveController.getEditTeacher);
router.post('/teachers/:id/edit', executiveController.updateTeacher);

// Student Management Routes
router.get('/students', executiveController.getStudents);
router.post('/students', executiveController.addStudent);
router.post('/students/delete', executiveController.deleteStudent);

// Manage Student details
router.get('/students/:student_id/manage', executiveController.getManageStudent);
router.post('/students/:student_id/manage/classroom', executiveController.updateStudentClassroom);
router.post('/students/:student_id/manage/subjects/add', executiveController.addSubjectToStudent);
router.post('/students/:student_id/manage/subjects/remove', executiveController.removeSubjectFromStudent);

module.exports = router;
