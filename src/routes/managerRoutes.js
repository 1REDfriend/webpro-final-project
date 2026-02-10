const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('manager'));

router.get('/dashboard', managerController.getDashboard);

module.exports = router;
