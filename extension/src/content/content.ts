declare const chrome: any

// Listen for image clicks and downloads
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement

  // Check if the click is on an image or image container
  if (isImageElement(target)) {
    // Send message to background script about potential download
    chrome.runtime.sendMessage({
      type: "POTENTIAL_IMAGE_INTERACTION",
      url: getImageUrl(target),
    })
  }
})

// Function to check if element is an image or contains an image
function isImageElement(element: HTMLElement): boolean {
  // Check if element is an image
  if (element.tagName === "IMG") {
    return true
  }

  // Check if element has background image
  const computedStyle = window.getComputedStyle(element)
  if (computedStyle.backgroundImage && computedStyle.backgroundImage !== "none") {
    return true
  }

  // Check if element contains an image
  const containsImage = element.querySelector("img")
  if (containsImage) {
    return true
  }

  return false
}

// Function to extract image URL from element
function getImageUrl(element: HTMLElement): string | null {
  // If element is an image, return src
  if (element.tagName === "IMG") {
    return (element as HTMLImageElement).src
  }

  // If element has background image, extract URL
  const computedStyle = window.getComputedStyle(element)
  if (computedStyle.backgroundImage && computedStyle.backgroundImage !== "none") {
    // Extract URL from background-image: url("...")
    const match = /url$$['"]?([^'"]+)['"]?$$/.exec(computedStyle.backgroundImage)
    if (match && match[1]) {
      return match[1]
    }
  }

  // If element contains an image, return that image's src
  const containsImage = element.querySelector("img")
  if (containsImage) {
    return (containsImage as HTMLImageElement).src
  }

  return null
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SHOW_WARNING") {
    showWarningOverlay(message.threatDetails)
  }
})

// Function to show warning overlay (defined in background.ts as well for direct injection)
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
