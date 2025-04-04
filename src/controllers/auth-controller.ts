import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { LoginSchema, RegisterSchema } from '../types/auth-type';
import { ZodError } from 'zod';
import { db } from '../lib/db';

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    // Validate incoming data
    const validatedData = RegisterSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(401).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create new user
    const user = await db.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
      },
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '24h',
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error signing in: ', error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Please provide valid data.' });
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    // Validate login data
    const validatedData = LoginSchema.parse(req.body);

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(
      validatedData.password,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token with user info
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, {
      expiresIn: '24h',
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'none',
    });

    res.json({ message: 'Logged in successfully' });
  } catch (error) {
    console.error('Error signing in: ', error);
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Please provide valid data.' });
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<any> => {
  try {
    // Grab token from cookies
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify token with secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }, // Return minimal user data
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Return user data to confirm authentication
    res.status(200).json({ id: user.id, email: user.email });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  // Clear token cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  
  res.json({ message: 'Logged out successfully' });
};