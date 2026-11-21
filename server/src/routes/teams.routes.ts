import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { parseId } from "../utils/httpError.js";
import {
  createMilestone,
  createMilestoneForTeams,
  getMilestone,
  getTeam,
  listMilestones,
  listTeams,
  updateMilestone,
} from "../services/teams.service.js";
import { createSubmission, getRevisionHistory, getSubmission, listSubmissions } from "../services/submissions.service.js";
import { createFeedback } from "../services/feedback.service.js";
import { getGrade, releaseGrade, saveGrade } from "../services/grades.service.js";

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

// F-06: the same milestone for several assigned teams in one request (all or nothing).
milestonesRouter.post("/", requireRole("SUPERVISOR"), handle(async (req, res) => {
  res.status(201).json({ milestones: await createMilestoneForTeams(req.user!, req.body) });
}));

milestonesRouter.get("/:milestoneId", handle(async (req, res) => {
  res.json({ milestone: await getMilestone(req.user!, parseId(req.params.milestoneId)) });
}));

// F-05: edit title/description, extend deadline (BR-13).
milestonesRouter.patch("/:milestoneId", requireRole("SUPERVISOR"), handle(async (req, res) => {
  res.json({ milestone: await updateMilestone(req.user!, parseId(req.params.milestoneId), req.body) });
}));

// F-08: grade per milestone; students see it only after release (BR-11).
milestonesRouter.get("/:milestoneId/grade", handle(async (req, res) => {
  res.json(await getGrade(req.user!, parseId(req.params.milestoneId)));
}));

milestonesRouter.put("/:milestoneId/grade", requireRole("SUPERVISOR"), handle(async (req, res) => {
  res.json(await saveGrade(req.user!, parseId(req.params.milestoneId), req.body));
}));

milestonesRouter.post("/:milestoneId/grade/release", requireRole("SUPERVISOR"), handle(async (req, res) => {
  res.json(await releaseGrade(req.user!, parseId(req.params.milestoneId)));
}));

milestonesRouter.get("/:milestoneId/submissions", handle(async (req, res) => {
  res.json({ submissions: await listSubmissions(req.user!, parseId(req.params.milestoneId)) });
}));

// F-07 (FR-15): full milestone revision history with per-version feedback.
milestonesRouter.get("/:milestoneId/history", handle(async (req, res) => {
  res.json({ history: await getRevisionHistory(req.user!, parseId(req.params.milestoneId), req.query.order) });
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

// Feedback is append-only (BR-09, D-08): there are no edit or delete routes.
submissionsRouter.post("/:submissionId/feedback", requireRole("SUPERVISOR"), handle(async (req, res) => {
  const feedback = await createFeedback(req.user!, parseId(req.params.submissionId), req.body);
  res.status(201).json({ feedback });
}));
