import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { startWeeklyReportJob } from "./jobs/weeklyReportJob.js";

const app = express();

const rawOrigins = (process.env.CORS_ORIGINS || env.CLIENT_URL || "").split(
  ","
);
const allowedOrigins = rawOrigins
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => s.toLowerCase().replace(/\/+$/, "")); // strip trailing slash

// --- Helmet (for APIs, disable CORP to avoid confusion) ---
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// --- CORS BEFORE routes ---
const corsOptions = {
  origin: (origin, cb) => {
    // allow non-browser clients (no Origin header)
    if (!origin) return cb(null, true);
    const normalized = origin.toLowerCase().replace(/\/+$/, "");
    if (allowedOrigins.includes(normalized)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Authorization"],
};
app.use(cors(corsOptions));
// make sure preflight is handled globally
app.options("*", cors(corsOptions));

// app.use(helmet());
// app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Mount your API (if you intended /api, use '/api' here)
app.use("/", routes);

// 404 + error handlers last
app.use(notFound);
app.use(errorHandler);

// Start
await connectDB();
startWeeklyReportJob();
app.listen(env.PORT, () =>
  console.log(`Server running on http://localhost:${env.PORT}`)
);
