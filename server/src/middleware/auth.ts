import type { Request, Response, NextFunction } from "express"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Middleware to authenticate API key
 */
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "API key required" })
    }

    const apiKey = authHeader.split(" ")[1]

    // Find user with this API key
    const user = await prisma.user.findFirst({
      where: { apiKey },
    })

    if (!user) {
      return res.status(401).json({ error: "Invalid API key" })
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
    }

    // Attach prisma client to request
    req.prisma = prisma

    next()
  } catch (error) {
    console.error("Authentication error:", error)
    res.status(500).json({ error: "Authentication failed" })
  }
}
