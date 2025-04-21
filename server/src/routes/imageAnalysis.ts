import express from "express"
import { ImageAnalysisService } from "../services/imageAnalysisService"
import { authenticateApiKey } from "../middleware/auth"
import type { ScanOptions } from "../types"

const router = express.Router()
const imageAnalysisService = new ImageAnalysisService()

/**
 * @route POST /api/analyze
 * @desc Analyze an image for security threats
 * @access Private (API key required)
 */
router.post("/", authenticateApiKey, async (req, res) => {
  try {
    const { imageUrl, scanOptions } = req.body

    // Validate request
    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" })
    }

    // Set default scan options if not provided
    const options: ScanOptions = {
      checkEmbeddedLinks: scanOptions?.checkEmbeddedLinks !== false,
      checkSteganography: scanOptions?.checkSteganography !== false,
      checkMaliciousCode: scanOptions?.checkMaliciousCode !== false,
    }

    // Get user ID from authenticated request
    const userId = req.user?.id

    // Analyze the image
    const result = await imageAnalysisService.analyzeImage(imageUrl, options, userId)

    // Return the analysis result
    res.json(result)
  } catch (error) {
    console.error("Error analyzing image:", error)
    res.status(500).json({ error: "Failed to analyze image" })
  }
})

/**
 * @route GET /api/analyze/history
 * @desc Get scan history for the authenticated user
 * @access Private (API key required)
 */
router.get("/history", authenticateApiKey, async (req, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    // Get scan history from database
    const history = await req.prisma.scanLog.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: 100,
    })

    res.json(history)
  } catch (error) {
    console.error("Error fetching scan history:", error)
    res.status(500).json({ error: "Failed to fetch scan history" })
  }
})

export const imageAnalysisRouter = router
