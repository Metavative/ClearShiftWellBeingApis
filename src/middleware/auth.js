import createError from "http-errors";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(createError(401, "Missing token"));
  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET); // { sub, email, role? }
    req.user = payload;
    next();
  } catch {
    next(createError(401, "Invalid or expired token"));
  }
}
