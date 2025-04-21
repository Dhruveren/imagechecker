"use client"

import type React from "react"
import "./Switch.css"

interface SwitchProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled = false }) => {
  return (
    <label className={`switch ${disabled ? "disabled" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="slider round"></span>
    </label>
  )
}
