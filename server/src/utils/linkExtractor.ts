import { createCanvas, loadImage } from "canvas"
import * as QRCode from "qrcode-reader"
import Jimp from "jimp"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"

export class LinkExtractor {
  /**
   * Extracts links from an image
   * @param imageData Image data buffer
   * @returns Array of extracted links
   */
  public async extractLinks(imageData: Buffer): Promise<string[]> {
    const links: string[] = []

    // Extract links using different methods
    const methods = [this.extractQRCodes, this.extractMetadata, this.extractSteganographicLinks]

    for (const method of methods) {
      try {
        const extractedLinks = await method.call(this, imageData)
        links.push(...extractedLinks)
      } catch (error) {
        console.error(`Error in link extraction method: ${error.message}`)
      }
    }

    // Remove duplicates
    return [...new Set(links)]
  }

  /**
   * Extracts QR codes from an image
   * @param imageData Image data buffer
   * @returns Array of links from QR codes
   */
  private async extractQRCodes(imageData: Buffer): Promise<string[]> {
    const links: string[] = []

    try {
      // Convert buffer to Jimp image
      const image = await Jimp.read(imageData)

      // Create QR code reader
      const qrReader = new QRCode()

      // Convert to grayscale to improve detection
      image.grayscale()

      // Extract QR code
      const result = await new Promise<{ result: string } | null>((resolve) => {
        qrReader.callback = (err, result) => {
          if (err || !result) {
            resolve(null)
          } else {
            resolve(result)
          }
        }

        qrReader.decode(image.bitmap)
      })

      if (result && result.result) {
        // Check if the result is a URL
        if (this.isValidUrl(result.result)) {
          links.push(result.result)
        }
      }

      // Try different image processing techniques to find more QR codes
      const variations = [() => image.contrast(0.5), () => image.brightness(0.2), () => image.invert()]

      for (const variation of variations) {
        // Apply variation to a copy of the image
        const modifiedImage = image.clone()
        variation()

        // Try to extract QR code again
        const varResult = await new Promise<{ result: string } | null>((resolve) => {
          qrReader.callback = (err, result) => {
            if (err || !result) {
              resolve(null)
            } else {
              resolve(result)
            }
          }

          qrReader.decode(modifiedImage.bitmap)
        })

        if (varResult && varResult.result && this.isValidUrl(varResult.result)) {
          links.push(varResult.result)
        }
      }
    } catch (error) {
      console.error("Error extracting QR codes:", error)
    }

    return [...new Set(links)] // Remove duplicates
  }

  /**
   * Extracts links from image metadata
   * @param imageData Image data buffer
   * @returns Array of links from metadata
   */
  private async extractMetadata(imageData: Buffer): Promise<string[]> {
    const links: string[] = []

    try {
      // Create a temporary file to use with metadata extraction tools
      const tempFilePath = path.join(__dirname, `../../temp/meta_${crypto.randomBytes(8).toString("hex")}.jpg`)

      fs.writeFileSync(tempFilePath, imageData)

      // Extract EXIF data (simplified example)
      // In a real implementation, use a library like 'exif-parser' or 'exiftool'
      const exifData = await this.mockExifExtraction(tempFilePath)

      // Look for URLs in various metadata fields
      for (const field of Object.values(exifData)) {
        if (typeof field === "string") {
          const urls = this.extractUrlsFromText(field)
          links.push(...urls)
        }
      }

      // Clean up temp file
      fs.unlinkSync(tempFilePath)
    } catch (error) {
      console.error("Error extracting metadata:", error)
    }

    return links
  }

  /**
   * Extracts links hidden using steganography
   * @param imageData Image data buffer
   * @returns Array of links from steganography
   */
  private async extractSteganographicLinks(imageData: Buffer): Promise<string[]> {
    const links: string[] = []

    try {
      // Load image
      const image = await loadImage(imageData)
      const canvas = createCanvas(image.width, image.height)
      const ctx = canvas.getContext("2d")
      ctx.drawImage(image, 0, 0)

      // Get image data
      const imageDataObj = ctx.getImageData(0, 0, image.width, image.height)
      const pixels = imageDataObj.data

      // Extract LSB (Least Significant Bit) data
      // This is a simplified implementation of LSB steganography detection
      let binaryData = ""

      // Extract LSBs from the first 1000 pixels (or fewer if the image is smaller)
      const pixelsToCheck = Math.min(pixels.length / 4, 1000)

      for (let i = 0; i < pixelsToCheck; i++) {
        const r = pixels[i * 4]
        const g = pixels[i * 4 + 1]
        const b = pixels[i * 4 + 2]

        // Extract LSB from each color channel
        binaryData += (r & 1).toString()
        binaryData += (g & 1).toString()
        binaryData += (b & 1).toString()
      }

      // Convert binary to ASCII
      let asciiText = ""
      for (let i = 0; i < binaryData.length; i += 8) {
        const byte = binaryData.substr(i, 8)
        if (byte.length === 8) {
          const charCode = Number.parseInt(byte, 2)
          if (charCode >= 32 && charCode <= 126) {
            // Printable ASCII
            asciiText += String.fromCharCode(charCode)
          }
        }
      }

      // Extract URLs from the ASCII text
      const urls = this.extractUrlsFromText(asciiText)
      links.push(...urls)
    } catch (error) {
      console.error("Error extracting steganographic links:", error)
    }

    return links
  }

  /**
   * Extracts URLs from text
   * @param text Text to search for URLs
   * @returns Array of URLs found in the text
   */
  private extractUrlsFromText(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const matches = text.match(urlRegex)
    return matches || []
  }

  /**
   * Checks if a string is a valid URL
   * @param str String to check
   * @returns True if the string is a valid URL
   */
  private isValidUrl(str: string): boolean {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  /**
   * Mock EXIF extraction (placeholder for actual implementation)
   * @param filePath Path to the image file
   * @returns Mock EXIF data
   */
  private async mockExifExtraction(filePath: string): Promise<Record<string, string>> {
    // In a real implementation, use a proper EXIF extraction library
    return {
      make: "Camera Brand",
      model: "Camera Model",
      software: "Editing Software",
      description: "Image description text",
      comment: "Image comment field",
    }
  }
}
