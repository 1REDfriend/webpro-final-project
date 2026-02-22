const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('teacher'));

router.get('/dashboard', teacherController.getDashboard);
router.post('/subjects', teacherController.addSubject);
router.post('/homeroom', teacherController.selectHomeroom);
router.get('/classes', teacherController.getClasses);
router.post('/behavior', teacherController.updateBehavior);
router.post('/grade', teacherController.updateGrade);
router.get('/requests', teacherController.getRequests);
router.post('/requests', teacherController.postRequest);

module.exports = router;
