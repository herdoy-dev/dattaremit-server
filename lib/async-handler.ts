import type { Request, Response, NextFunction } from "express";

type AsyncRequestHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export default function asyncHandler<Req extends Request = Request>(
  fn: AsyncRequestHandler<Req>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
