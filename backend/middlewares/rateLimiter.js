import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: process.env.RATE_LIMIT_MAX || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// export const apiLimiter =
//   process.env.NODE_ENV === "test"
//     ? (req, res, next) => next()
//     : rateLimit({
//         windowMs: 15 * 60 * 1000,
//         max: process.env.RATE_LIMIT_MAX || 100,
//       });