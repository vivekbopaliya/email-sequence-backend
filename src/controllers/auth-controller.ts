import { Request, RequestHandler, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { LoginSchema, RegisterSchema } from '../types/auth-type';
import { ZodError } from 'zod';
import { db } from '../lib/db';


export const register = async (req: Request, res: Response) : Promise<any>=> {
  try {
    const validatedData = RegisterSchema.parse(req.body);
    
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return res.status(401).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const user = await db.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: '24h',
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error signing in: ', error);
    if(error instanceof ZodError) {
      return res.status(400).json({message: "Please provide valid data. "})
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = LoginSchema.parse(req.body);

    const user = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(
      validatedData.password,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email}, process.env.JWT_SECRET!, {
      expiresIn: '24h',
    });

    res.cookie('token', token, {
      httpOnly: true,
      domain: process.env.FRONTEND_URL,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ message: 'Logged in successfully' });
  } catch (error) {
    console.error('Error signing in: ', error);
    if(error instanceof ZodError) {
      return res.status(400).json({message: "Please provide valid data. "})
    }
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};

export const logout = async(req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
  
};