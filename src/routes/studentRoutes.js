const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('student'));

router.get('/dashboard', studentController.getDashboard);
router.get('/grades', studentController.getGrades);
router.get('/schedule', studentController.getSchedule);
router.get('/requests', studentController.getRequests);
router.post('/requests', studentController.postRequest);
router.get('/transcript/download', studentController.downloadTranscript);

module.exports = router;
