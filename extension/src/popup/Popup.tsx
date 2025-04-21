"use client"

import type React from "react"
import { useEffect, useState } from "react"
import "./Popup.css"
import { Switch } from "../components/Switch"
import { Shield, Settings, AlertTriangle, CheckCircle } from "lucide-react"

interface ScanStats {
  totalScanned: number
  threatsBlocked: number
}

// Declare chrome if it's not available globally
declare const chrome: any

const Popup: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(true)
  const [isAutoMode, setIsAutoMode] = useState<boolean>(true)
  const [stats, setStats] = useState<ScanStats>({ totalScanned: 0, threatsBlocked: 0 })
  const [status, setStatus] = useState<"idle" | "scanning" | "safe" | "threat">("idle")

  useEffect(() => {
    // Load settings from chrome.storage
    chrome.storage.sync.get(["enabled", "autoMode", "stats"], (result) => {
      setIsEnabled(result.enabled !== undefined ? result.enabled : true)
      setIsAutoMode(result.autoMode !== undefined ? result.autoMode : true)
      setStats(result.stats || { totalScanned: 0, threatsBlocked: 0 })
    })

    // Listen for status updates from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "STATUS_UPDATE") {
        setStatus(message.status)

        // Update stats if needed
        if (message.status === "safe" || message.status === "threat") {
          chrome.storage.sync.get(["stats"], (result) => {
            const currentStats = result.stats || { totalScanned: 0, threatsBlocked: 0 }
            const newStats = {
              totalScanned: currentStats.totalScanned + 1,
              threatsBlocked:
                message.status === "threat" ? currentStats.threatsBlocked + 1 : currentStats.threatsBlocked,
            }

            chrome.storage.sync.set({ stats: newStats })
            setStats(newStats)
          })
        }
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(() => {})
    }
  }, [])

  const toggleEnabled = () => {
    const newState = !isEnabled
    setIsEnabled(newState)
    chrome.storage.sync.set({ enabled: newState })
    chrome.runtime.sendMessage({ type: "TOGGLE_ENABLED", enabled: newState })
  }

  const toggleAutoMode = () => {
    const newState = !isAutoMode
    setIsAutoMode(newState)
    chrome.storage.sync.set({ autoMode: newState })
    chrome.runtime.sendMessage({ type: "TOGGLE_AUTO_MODE", autoMode: newState })
  }

  const openSettings = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="popup-container">
      <div className="header">
        <Shield className="icon" size={24} />
        <h1>Image Shield</h1>
        <button className="settings-button" onClick={openSettings}>
          <Settings size={18} />
        </button>
      </div>

      <div className="status-indicator">
        {status === "idle" && <div className="status idle">Ready to protect</div>}
        {status === "scanning" && <div className="status scanning">Scanning image...</div>}
        {status === "safe" && (
          <div className="status safe">
            <CheckCircle size={16} />
            Image is safe
          </div>
        )}
        {status === "threat" && (
          <div className="status threat">
            <AlertTriangle size={16} />
            Threat detected and blocked
          </div>
        )}
      </div>

      <div className="toggle-container">
        <div className="toggle-item">
          <div className="toggle-label">
            <span>Protection</span>
            <span className="toggle-status">{isEnabled ? "On" : "Off"}</span>
          </div>
          <Switch checked={isEnabled} onChange={toggleEnabled} />
        </div>

        <div className="toggle-item">
          <div className="toggle-label">
            <span>Auto Mode</span>
            <span className="toggle-status">{isAutoMode ? "On" : "Off"}</span>
          </div>
          <Switch checked={isAutoMode} onChange={toggleAutoMode} disabled={!isEnabled} />
        </div>
      </div>

      <div className="stats-container">
        <div className="stat-item">
          <span className="stat-label">Images Scanned</span>
          <span className="stat-value">{stats.totalScanned}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Threats Blocked</span>
          <span className="stat-value">{stats.threatsBlocked}</span>
        </div>
      </div>
    </div>
  )
}

export default Popup
