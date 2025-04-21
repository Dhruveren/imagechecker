"use client"

import type React from "react"
import { useEffect, useState } from "react"
import "./Options.css"
import { ImageAnalysisService } from "../services/ImageAnalysisService"

interface OptionsState {
  apiKey: string
  apiUrl: string
  showSafeNotifications: boolean
  monitoredDomains: string[]
  newDomain: string
  scanOptions: {
    checkEmbeddedLinks: boolean
    checkSteganography: boolean
    checkMaliciousCode: boolean
  }
}

const Options: React.FC = () => {
  const [state, setState] = useState<OptionsState>({
    apiKey: "",
    apiUrl: "https://api.imageshield.com/analyze",
    showSafeNotifications: false,
    monitoredDomains: [
      "web.whatsapp.com",
      "mail.google.com",
      "outlook.live.com",
      "facebook.com",
      "twitter.com",
      "instagram.com",
    ],
    newDomain: "",
    scanOptions: {
      checkEmbeddedLinks: true,
      checkSteganography: true,
      checkMaliciousCode: true,
    },
  })

  const imageAnalysisService = new ImageAnalysisService()

  useEffect(() => {
    // Load settings from storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.get(
        ["apiKey", "apiUrl", "showSafeNotifications", "monitoredDomains", "scanOptions"],
        (result) => {
          setState((prevState) => ({
            ...prevState,
            apiKey: result.apiKey || "",
            apiUrl: result.apiUrl || "https://api.imageshield.com/analyze",
            showSafeNotifications: result.showSafeNotifications || false,
            monitoredDomains: result.monitoredDomains || prevState.monitoredDomains,
            scanOptions: result.scanOptions || prevState.scanOptions,
          }))
        },
      )
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target

    setState((prevState) => ({
      ...prevState,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleScanOptionChange = (option: keyof typeof state.scanOptions) => {
    setState((prevState) => ({
      ...prevState,
      scanOptions: {
        ...prevState.scanOptions,
        [option]: !prevState.scanOptions[option],
      },
    }))
  }

  const handleAddDomain = () => {
    if (state.newDomain && !state.monitoredDomains.includes(state.newDomain)) {
      const updatedDomains = [...state.monitoredDomains, state.newDomain]
      setState((prevState) => ({
        ...prevState,
        monitoredDomains: updatedDomains,
        newDomain: "",
      }))

      // Save to storage
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.set({ monitoredDomains: updatedDomains })
      }
    }
  }

  const handleRemoveDomain = (domain: string) => {
    const updatedDomains = state.monitoredDomains.filter((d) => d !== domain)
    setState((prevState) => ({
      ...prevState,
      monitoredDomains: updatedDomains,
    }))

    // Save to storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({ monitoredDomains: updatedDomains })
    }
  }

  const handleSave = () => {
    // Save all settings to storage
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.sync.set({
        apiKey: state.apiKey,
        apiUrl: state.apiUrl,
        showSafeNotifications: state.showSafeNotifications,
        scanOptions: state.scanOptions,
      })
    }

    // Update API URL in service
    imageAnalysisService.updateApiUrl(state.apiUrl)

    // Show success message
    const status = document.getElementById("status")
    if (status) {
      status.textContent = "Options saved."
      setTimeout(() => {
        status.textContent = ""
      }, 3000)
    }
  }

  return (
    <div className="options-container">
      <h1>Image Shield Settings</h1>

      <div className="section">
        <h2>API Configuration</h2>
        <div className="form-group">
          <label htmlFor="apiKey">API Key</label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            value={state.apiKey}
            onChange={handleInputChange}
            placeholder="Enter your API key"
          />
        </div>

        <div className="form-group">
          <label htmlFor="apiUrl">API URL</label>
          <input
            type="text"
            id="apiUrl"
            name="apiUrl"
            value={state.apiUrl}
            onChange={handleInputChange}
            placeholder="API endpoint URL"
          />
        </div>
      </div>

      <div className="section">
        <h2>Scan Options</h2>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={state.scanOptions.checkEmbeddedLinks}
              onChange={() => handleScanOptionChange("checkEmbeddedLinks")}
            />
            Check for embedded links
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={state.scanOptions.checkSteganography}
              onChange={() => handleScanOptionChange("checkSteganography")}
            />
            Check for steganography (hidden data)
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={state.scanOptions.checkMaliciousCode}
              onChange={() => handleScanOptionChange("checkMaliciousCode")}
            />
            Check for malicious code
          </label>
        </div>
      </div>

      <div className="section">
        <h2>Notifications</h2>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              name="showSafeNotifications"
              checked={state.showSafeNotifications}
              onChange={handleInputChange}
            />
            Show notifications for safe images
          </label>
        </div>
      </div>

      <div className="section">
        <h2>Monitored Domains</h2>
        <p className="help-text">The extension will monitor image downloads from these domains:</p>

        <div className="domains-list">
          {state.monitoredDomains.map((domain) => (
            <div key={domain} className="domain-item">
              <span>{domain}</span>
              <button className="remove-button" onClick={() => handleRemoveDomain(domain)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="add-domain">
          <input
            type="text"
            name="newDomain"
            value={state.newDomain}
            onChange={handleInputChange}
            placeholder="Enter domain (e.g., example.com)"
          />
          <button onClick={handleAddDomain}>Add</button>
        </div>
      </div>

      <div className="actions">
        <button className="save-button" onClick={handleSave}>
          Save Settings
        </button>
        <div id="status" className="status-message"></div>
      </div>
    </div>
  )
}

export default Options
