import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { parseId } from "../utils/httpError.js";
import { createMilestone, getMilestone, getTeam, listMilestones, listTeams } from "../services/teams.service.js";
import { createSubmission, getSubmission, listSubmissions } from "../services/submissions.service.js";

type Handler = (req: Request, res: Response) => Promise<void>;

// Forward thrown errors (including HttpError) to the app's error handler.
const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const teamsRouter = Router();
teamsRouter.use(authenticate);

teamsRouter.get("/", handle(async (req, res) => {
  res.json({ teams: await listTeams(req.user!) });
}));

teamsRouter.get("/:teamId", handle(async (req, res) => {
  res.json({ team: await getTeam(req.user!, parseId(req.params.teamId)) });
}));

teamsRouter.get("/:teamId/milestones", handle(async (req, res) => {
  res.json({ milestones: await listMilestones(req.user!, parseId(req.params.teamId)) });
}));

teamsRouter.post("/:teamId/milestones", requireRole("SUPERVISOR"), handle(async (req, res) => {
  const milestone = await createMilestone(req.user!, parseId(req.params.teamId), req.body);
  res.status(201).json({ milestone });
}));

export const milestonesRouter = Router();
milestonesRouter.use(authenticate);

milestonesRouter.get("/:milestoneId", handle(async (req, res) => {
  res.json({ milestone: await getMilestone(req.user!, parseId(req.params.milestoneId)) });
}));

milestonesRouter.get("/:milestoneId/submissions", handle(async (req, res) => {
  res.json({ submissions: await listSubmissions(req.user!, parseId(req.params.milestoneId)) });
}));

milestonesRouter.post("/:milestoneId/submissions", requireRole("STUDENT"), handle(async (req, res) => {
  const submission = await createSubmission(req.user!, parseId(req.params.milestoneId), req.body);
  res.status(201).json({ submission });
}));

export const submissionsRouter = Router();
submissionsRouter.use(authenticate);

submissionsRouter.get("/:submissionId", handle(async (req, res) => {
  res.json({ submission: await getSubmission(req.user!, parseId(req.params.submissionId)) });
}));
