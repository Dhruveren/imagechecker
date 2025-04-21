export interface ScanOptions {
  checkEmbeddedLinks: boolean
  checkSteganography: boolean
  checkMaliciousCode: boolean
}

export interface AnalysisResult {
  isSafe: boolean
  confidence: number
  threats: Threat[]
  threatDetails?: string
}

export interface Threat {
  type: string
  description: string
  severity: "high" | "medium" | "low"
}

export interface AuthenticatedUser {
  id: string
  email: string
}

// Request augmentation for Express
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
      prisma: import("@prisma/client").PrismaClient
    }
  }
}
