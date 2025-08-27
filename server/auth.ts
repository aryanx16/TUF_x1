import { storage } from "./storage.js";

// Simple session-based authentication
export interface AuthSession {
  userId: string;
  email: string;
  isAuthenticated: boolean;
}

// Middleware to check if user is authenticated
export function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Get current user from session
export async function getCurrentUser(req: any) {
  if (!req.session?.userId) {
    return null;
  }
  return await storage.getUser(req.session.userId);
}

// Simple login function (in real app, you'd verify password)
export async function loginUser(req: any, email: string, userId?: string) {
  let user;
  
  if (userId) {
    user = await storage.getUser(userId);
  } else {
    // For demo purposes, create user if doesn't exist
    user = await storage.upsertUser({
      id: `user_${Date.now()}`,
      email: email,
    });
  }
  
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.isAuthenticated = true;
  
  return user;
}

// Logout function
export function logoutUser(req: any) {
  req.session.destroy();
}