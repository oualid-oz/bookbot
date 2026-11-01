import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(255),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const profileUpdateSchema = z.object({
  name: signupSchema.shape.name,
});

/** currentPassword is required when the account already has a password */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().max(PASSWORD_MAX_LENGTH).optional(),
  newPassword: signupSchema.shape.password,
});

/** Accounts with a password confirm with it; others type their email */
export const accountDeleteSchema = z.object({
  password: z.string().max(PASSWORD_MAX_LENGTH).optional(),
  email: z.string().trim().toLowerCase().max(255).optional(),
});

export const orgUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
});
