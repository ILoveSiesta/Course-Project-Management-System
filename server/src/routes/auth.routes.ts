import { Router, Request, Response, NextFunction } from "express";
import { loginService, logoutService, AuthError } from "../services/auth.service.js";
import { authenticate } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loginService(req.body.email, req.body.password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
    }
    next(err);
  }
});

authRouter.post("/logout", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.tokenJti) {
      await logoutService(req.tokenJti, req.tokenExp);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});
