import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // Grab token from cookies
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify token with secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    const user = await db.user.findUnique({
      where: { id: (decoded as any).userId },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user to request if user exists(we changed type for Request in index.ts)
    req.user = user;
    next(); // Move to the route/next middleware
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};