import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface Props { targetDate: string }
interface TimeLeft { days: number; hours: number; minutes: number; seconds: number }

function calculate(target: string): TimeLeft | null {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="countdown-digit">
      <div className="countdown-box" aria-label={`${value} ${label}`}>
        <span className="font-mono font-bold text-xl gradient-text">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-muted text-xs mt-1">{label}</span>
    </div>
  )
}

export default function CountdownTimer({ targetDate }: Props) {
  const { t } = useTheme()
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(calculate(targetDate))

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculate(targetDate)), 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  if (!timeLeft) {
    return <span className="text-muted text-sm italic">{t('countdown.over')}</span>
  }

  return (
    <div className="flex items-center gap-2" role="timer" aria-live="off">
      <Digit value={timeLeft.days}    label={t('countdown.days')} />
      <span className="text-muted text-lg pb-4" aria-hidden="true">:</span>
      <Digit value={timeLeft.hours}   label={t('countdown.hours')} />
      <span className="text-muted text-lg pb-4" aria-hidden="true">:</span>
      <Digit value={timeLeft.minutes} label={t('countdown.minutes')} />
      <span className="text-muted text-lg pb-4" aria-hidden="true">:</span>
      <Digit value={timeLeft.seconds} label={t('countdown.seconds')} />
    </div>
  )
}
