import { PrismaClient } from "@prisma/client"
import fetch from "node-fetch"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import * as util from "util"
import { pipeline } from "stream"
import { SteganographyDetector } from "../utils/steganographyDetector"
import { LinkExtractor } from "../utils/linkExtractor"
import { MaliciousCodeDetector } from "../utils/maliciousCodeDetector"
import type { AnalysisResult, ScanOptions } from "../types"

const streamPipeline = util.promisify(pipeline)
const prisma = new PrismaClient()

export class ImageAnalysisService {
  private readonly tempDir: string
  private readonly steganographyDetector: SteganographyDetector
  private readonly linkExtractor: LinkExtractor
  private readonly maliciousCodeDetector: MaliciousCodeDetector

  constructor() {
    this.tempDir = path.join(__dirname, "../../temp")

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }

    this.steganographyDetector = new SteganographyDetector()
    this.linkExtractor = new LinkExtractor()
    this.maliciousCodeDetector = new MaliciousCodeDetector()
  }

  /**
   * Analyzes an image for security threats
   * @param imageUrl URL of the image to analyze
   * @param options Scan options
   * @param userId Optional user ID for logging
   * @returns Analysis result
   */
  public async analyzeImage(imageUrl: string, options: ScanOptions, userId?: string): Promise<AnalysisResult> {
    try {
      // Generate a unique filename
      const filename = `${crypto.randomBytes(16).toString("hex")}.jpg`
      const filepath = path.join(this.tempDir, filename)

      // Download the image
      const imageData = await this.downloadImage(imageUrl, filepath)

      // Initialize result
      const result: AnalysisResult = {
        isSafe: true,
        confidence: 1.0,
        threats: [],
      }

      // Run selected scans
      const scanPromises: Promise<void>[] = []

      if (options.checkEmbeddedLinks) {
        scanPromises.push(this.scanForEmbeddedLinks(imageData, result))
      }

      if (options.checkSteganography) {
        scanPromises.push(this.scanForSteganography(imageData, result))
      }

      if (options.checkMaliciousCode) {
        scanPromises.push(this.scanForMaliciousCode(imageData, result))
      }

      // Wait for all scans to complete
      await Promise.all(scanPromises)

      // Clean up the temporary file
      fs.unlinkSync(filepath)

      // Log the scan result if user ID is provided
      if (userId) {
        await this.logScanResult(userId, imageUrl, result)
      }

      // Set overall safety status
      result.isSafe = result.threats.length === 0

      // Calculate confidence score based on threats
      if (!result.isSafe) {
        // Reduce confidence based on number and severity of threats
        const confidenceReduction = result.threats.reduce((total, threat) => {
          return total + (threat.severity === "high" ? 0.3 : threat.severity === "medium" ? 0.2 : 0.1)
        }, 0)

        result.confidence = Math.max(0.1, 1.0 - confidenceReduction)
      }

      // Format threat details for display
      if (result.threats.length > 0) {
        result.threatDetails = result.threats
          .map((t) => `${t.type}: ${t.description} (${t.severity} severity)`)
          .join("; ")
      }

      return result
    } catch (error) {
      console.error("Image analysis error:", error)
      throw new Error(`Failed to analyze image: ${error.message}`)
    }
  }

  /**
   * Downloads an image from a URL to a local file
   * @param url Image URL
   * @param filepath Local file path
   * @returns Buffer containing the image data
   */
  private async downloadImage(url: string, filepath: string): Promise<Buffer> {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    await streamPipeline(response.body, fs.createWriteStream(filepath))

    return fs.readFileSync(filepath)
  }

  /**
   * Scans an image for embedded links
   * @param imageData Image data buffer
   * @param result Analysis result to update
   */
  private async scanForEmbeddedLinks(imageData: Buffer, result: AnalysisResult): Promise<void> {
    try {
      const links = await this.linkExtractor.extractLinks(imageData)

      if (links.length > 0) {
        // Check each link against malicious URL database
        for (const link of links) {
          const isMalicious = await this.checkIfUrlIsMalicious(link)

          if (isMalicious) {
            result.threats.push({
              type: "embedded_link",
              description: `Malicious URL detected: ${link}`,
              severity: "high",
            })
          }
        }
      }
    } catch (error) {
      console.error("Error scanning for embedded links:", error)
    }
  }

  /**
   * Scans an image for steganography (hidden data)
   * @param imageData Image data buffer
   * @param result Analysis result to update
   */
  private async scanForSteganography(imageData: Buffer, result: AnalysisResult): Promise<void> {
    try {
      const steganographyResult = await this.steganographyDetector.detect(imageData)

      if (steganographyResult.detected) {
        result.threats.push({
          type: "steganography",
          description: `Hidden data detected: ${steganographyResult.details}`,
          severity: "medium",
        })
      }
    } catch (error) {
      console.error("Error scanning for steganography:", error)
    }
  }

  /**
   * Scans an image for malicious code
   * @param imageData Image data buffer
   * @param result Analysis result to update
   */
  private async scanForMaliciousCode(imageData: Buffer, result: AnalysisResult): Promise<void> {
    try {
      const codeResult = await this.maliciousCodeDetector.detect(imageData)

      if (codeResult.detected) {
        result.threats.push({
          type: "malicious_code",
          description: `Potentially malicious code detected: ${codeResult.details}`,
          severity: "high",
        })
      }
    } catch (error) {
      console.error("Error scanning for malicious code:", error)
    }
  }

  /**
   * Checks if a URL is known to be malicious
   * @param url URL to check
   * @returns True if the URL is malicious
   */
  private async checkIfUrlIsMalicious(url: string): Promise<boolean> {
    try {
      // Check against known malicious URL database
      const maliciousUrl = await prisma.maliciousUrl.findFirst({
        where: {
          OR: [{ url: url }, { url: { contains: new URL(url).hostname } }],
        },
      })

      if (maliciousUrl) {
        return true
      }

      // Additional checks could be implemented here:
      // 1. Call to external threat intelligence API
      // 2. Check for suspicious patterns in the URL
      // 3. Check for URL shorteners

      return false
    } catch (error) {
      console.error("Error checking malicious URL:", error)
      return false
    }
  }

  /**
   * Logs a scan result to the database
   * @param userId User ID
   * @param imageUrl Image URL
   * @param result Analysis result
   */
  private async logScanResult(userId: string, imageUrl: string, result: AnalysisResult): Promise<void> {
    try {
      await prisma.scanLog.create({
        data: {
          userId,
          imageUrl,
          isSafe: result.isSafe,
          confidence: result.confidence,
          threatDetails: result.threatDetails || null,
          threatCount: result.threats.length,
          timestamp: new Date(),
        },
      })
    } catch (error) {
      console.error("Error logging scan result:", error)
    }
  }
}
