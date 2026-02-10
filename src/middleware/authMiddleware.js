const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

const hasRole = (role) => {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            return next();
        }
        res.status(403).send('Forbidden');
    };
};

module.exports = { isAuthenticated, hasRole };
