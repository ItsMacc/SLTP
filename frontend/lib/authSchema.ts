import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, 'Password must be at least 8 characters'),
});

export const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.email({ message: 'Please enter a valid email address' }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;