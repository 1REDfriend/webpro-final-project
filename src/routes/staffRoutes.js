const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('staff'));

router.get('/dashboard', staffController.getDashboard);
router.post('/request-update', staffController.updateRequestStatus);

module.exports = router;
