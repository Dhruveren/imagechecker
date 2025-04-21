import express from "express"
import cors from "cors"
import helmet from "helmet"
import { PrismaClient } from "@prisma/client"
import { imageAnalysisRouter } from "./routes/imageAnalysis"
import { authRouter } from "./routes/auth"
import { userRouter } from "./routes/user"
import { configRouter } from "./routes/config"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"
import { rateLimiter } from "./middleware/rateLimiter"

// Initialize Prisma client
const prisma = new PrismaClient()

// Create Express app
const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet()) // Security headers
app.use(cors()) // CORS support
app.use(express.json({ limit: "10mb" })) // Parse JSON bodies
app.use(requestLogger) // Log requests
app.use(rateLimiter) // Rate limiting

// Routes
app.use("/api/analyze", imageAnalysisRouter)
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/config", configRouter)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

// Error handling
app.use(errorHandler)

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(async () => {
    await prisma.$disconnect()
    console.log("Server closed")
    process.exit(0)
  })
})

export { app, prisma }
