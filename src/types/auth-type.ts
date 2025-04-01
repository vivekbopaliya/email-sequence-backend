import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string(),
});


export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type Register = z.infer<typeof RegisterSchema>;
export type Login = z.infer<typeof LoginSchema>;