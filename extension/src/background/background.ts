import { ImageAnalysisService } from "../services/ImageAnalysisService"
declare const chrome: any;

// Declare chrome variable if it's not available globally
// declare const chrome: any

// Initialize the image analysis service
const imageAnalysisService = new ImageAnalysisService()

// Extension state
let isEnabled = true
let isAutoMode = true

// Load settings from storage
chrome.storage.sync.get(["enabled", "autoMode"], (result: { enabled?: boolean; autoMode?: boolean }) => {
  isEnabled = result.enabled !== undefined ? result.enabled : true
  isAutoMode = result.autoMode !== undefined ? result.autoMode : true
})

// Listen for messages from popup
interface ToggleEnabledMessage {
  type: "TOGGLE_ENABLED";
  enabled: boolean;
}

interface ToggleAutoModeMessage {
  type: "TOGGLE_AUTO_MODE";
  autoMode: boolean;
}

interface ManualScanMessage {
  type: "MANUAL_SCAN";
  imageUrl: string;
  tabId: number | undefined;
  downloadId: number;
}

type Message = ToggleEnabledMessage | ToggleAutoModeMessage | ManualScanMessage;

chrome.runtime.onMessage.addListener((message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === "TOGGLE_ENABLED") {
    isEnabled = message.enabled;
  } else if (message.type === "TOGGLE_AUTO_MODE") {
    isAutoMode = message.autoMode;
  } else if (message.type === "MANUAL_SCAN") {
    // Handle manual scan request
    scanImage(message.imageUrl, message.tabId, message.downloadId);
  }
});

// Monitor downloads
chrome.downloads.onCreated.addListener(async (downloadItem: chrome.downloads.DownloadItem) => {
  // Only proceed if extension is enabled
  if (!isEnabled) return

  // Only auto-scan if auto mode is enabled
  if (!isAutoMode) return

  // Check if this is an image download
  if (isImageDownload(downloadItem)) {
    // Pause the download immediately
    chrome.downloads.pause(downloadItem.id)

    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]

    // Check if this is from web.whatsapp.com or other monitored domains
    if (activeTab && isMonitoredDomain(activeTab.url)) {
      // Notify UI that we're scanning
      chrome.runtime.sendMessage({
        type: "STATUS_UPDATE",
        status: "scanning",
      })

      // Scan the image
      scanImage(downloadItem.url, activeTab.id, downloadItem.id)
    } else {
      // Not a monitored domain, resume download
      chrome.downloads.resume(downloadItem.id)
    }
  }
})

// Function to check if download is an image
function isImageDownload(downloadItem: chrome.downloads.DownloadItem): boolean {
  const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"]
  return imageTypes.includes(downloadItem.mime)
}

// Function to check if URL is from a monitored domain
function isMonitoredDomain(url: string | undefined): boolean {
  if (!url) return false

  const monitoredDomains = [
    "web.whatsapp.com",
    "mail.google.com",
    "outlook.live.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
  ]

  return monitoredDomains.some((domain) => url.includes(domain))
}

// Function to scan an image
async function scanImage(imageUrl: string, tabId: number | undefined, downloadId: number): Promise<void> {
  try {
    // Call the backend API to analyze the image
    const result = await imageAnalysisService.analyzeImage(imageUrl)

    if (result.isSafe) {
      // Image is safe, resume download
      chrome.downloads.resume(downloadId)

      // Update status
      chrome.runtime.sendMessage({
        type: "STATUS_UPDATE",
        status: "safe",
      })

      // Show notification if configured
      chrome.storage.sync.get(["showSafeNotifications"], (result: { showSafeNotifications?: boolean }) => {
        if (result.showSafeNotifications) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "assets/icon-128.png",
            title: "Image Shield",
            message: "Image scanned and verified as safe.",
          })
        }
      })
    } else {
      // Image contains threats, cancel download
      chrome.downloads.cancel(downloadId)

      // Update status
      chrome.runtime.sendMessage({
        type: "STATUS_UPDATE",
        status: "threat",
      })

      // Show warning notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/icon-warning-128.png",
        title: "Security Alert",
        message: `Potential threat detected in image: ${result.threatDetails}`,
      })

      // If tab is available, show warning in page
      if (tabId) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: showWarningOverlay,
          args: [result.threatDetails],
        })
      }
    }
  } catch (error) {
    console.error("Error scanning image:", error)

    // On error, allow download but log the issue
    chrome.downloads.resume(downloadId)

    // Update status
    chrome.runtime.sendMessage({
      type: "STATUS_UPDATE",
      status: "idle",
    })
  }
}

// Function to show warning overlay in the page
function showWarningOverlay(threatDetails: string): void {
  const overlay = document.createElement("div")
  overlay.style.position = "fixed"
  overlay.style.top = "0"
  overlay.style.left = "0"
  overlay.style.width = "100%"
  overlay.style.height = "100%"
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)"
  overlay.style.zIndex = "9999"
  overlay.style.display = "flex"
  overlay.style.flexDirection = "column"
  overlay.style.alignItems = "center"
  overlay.style.justifyContent = "center"
  overlay.style.color = "white"
  overlay.style.fontFamily = "Arial, sans-serif"
  overlay.style.padding = "20px"

  const warningIcon = document.createElement("div")
  warningIcon.innerHTML = `
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  `

  const title = document.createElement("h2")
  title.textContent = "Security Threat Detected"
  title.style.margin = "20px 0"

  const message = document.createElement("p")
  message.textContent = `The image you attempted to download contains a potential security threat: ${threatDetails}`
  message.style.maxWidth = "600px"
  message.style.textAlign = "center"
  message.style.marginBottom = "20px"

  const closeButton = document.createElement("button")
  closeButton.textContent = "Close"
  closeButton.style.padding = "10px 20px"
  closeButton.style.backgroundColor = "#4f46e5"
  closeButton.style.color = "white"
  closeButton.style.border = "none"
  closeButton.style.borderRadius = "4px"
  closeButton.style.cursor = "pointer"
  closeButton.onclick = () => {
    document.body.removeChild(overlay)
  }

  overlay.appendChild(warningIcon)
  overlay.appendChild(title)
  overlay.appendChild(message)
  overlay.appendChild(closeButton)

  document.body.appendChild(overlay)

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay)
    }
  }, 10000)
}
