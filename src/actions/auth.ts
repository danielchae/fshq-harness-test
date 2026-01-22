'use server';

import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';

interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

interface SignUpResult {
  success: boolean;
  error?: string;
}

export async function signUpAction(input: SignUpInput): Promise<SignUpResult> {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // Create user
    await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: 'Failed to create account' };
  }
}
