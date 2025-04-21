interface AnalysisResult {
  isSafe: boolean
  threatDetails?: string
  confidence: number
}

export class ImageAnalysisService {
  private apiUrl: string

  constructor() {
    // Load API URL from environment or use default
    this.apiUrl = "https://api.imageshield.com/analyze"

    // Try to load from storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.get(["apiUrl"], (result) => {
        if (result.apiUrl) {
          this.apiUrl = result.apiUrl
        }
      })
    }
  }

  /**
   * Analyzes an image for potential security threats
   * @param imageUrl URL of the image to analyze
   * @returns Analysis result with safety information
   */
  public async analyzeImage(imageUrl: string): Promise<AnalysisResult> {
    try {
      // Get API key from storage
      const apiKeyResult = await new Promise<{ apiKey: string }>((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.sync.get(["apiKey"], (result) => {
            resolve({ apiKey: result.apiKey || "" })
          })
        } else {
          resolve({ apiKey: "" })
        }
      })
      const apiKey = apiKeyResult.apiKey

      // Prepare request
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          imageUrl,
          scanOptions: {
            checkEmbeddedLinks: true,
            checkSteganography: true,
            checkMaliciousCode: true,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      return {
        isSafe: data.isSafe,
        threatDetails: data.threatDetails,
        confidence: data.confidence,
      }
    } catch (error) {
      console.error("Image analysis failed:", error)

      // In case of error, default to safe to avoid blocking legitimate downloads
      // This can be configured differently based on security requirements
      return {
        isSafe: true,
        threatDetails: "Analysis failed, proceeding with caution",
        confidence: 0,
      }
    }
  }

  /**
   * Updates the API configuration
   * @param newApiUrl New API URL
   */
  public updateApiUrl(newApiUrl: string): void {
    this.apiUrl = newApiUrl
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({ apiUrl: newApiUrl })
    }
  }
}
