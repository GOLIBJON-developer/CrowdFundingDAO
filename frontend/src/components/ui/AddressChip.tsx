'use client'
import { useState } from 'react'
import { shortAddress, explorerUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AddressChipProps {
  address: `0x${string}` | string
  className?: string
  link?: boolean
  chars?: number
  label?: string
}

export function AddressChip({
  address,
  className,
  link = true,
  chars = 4,
  label,
}: AddressChipProps) {
  const [copied, setCopied] = useState(false)

  function copy(e: React.MouseEvent) {
    e.preventDefault()
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const short = shortAddress(address, chars)

  const inner = (
    <span
      onClick={copy}
      title={address}
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs',
        'text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors',
        className
      )}
    >
      {label && <span className="text-zinc-600">{label}:</span>}
      <span>{copied ? '✓ copied' : short}</span>
    </span>
  )

  if (link) {
    const url = explorerUrl(address, 'address')
    return url !== '#'
      ? <a href={url} target="_blank" rel="noopener noreferrer">{inner}</a>
      : inner
  }

  return inner
}
