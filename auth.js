const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.id };
        next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized to access this route' });
    }
};

exports.authorize = (...roles) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!roles.includes(user.role)) {
                return res.status(403).json({ message: 'Not authorized for this action' });
            }

            next();
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    };
};
