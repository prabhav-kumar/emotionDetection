import jwt from 'jsonwebtoken';

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No authentication token, access denied' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            req.token = token;
            next();
        } catch (error) {
            res.status(401).json({ message: 'Token is not valid' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export default auth;  // ES6 default export