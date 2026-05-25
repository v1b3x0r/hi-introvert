/**
 * Outside weather sensor — fetches wttr.in (no API key).
 * Silent fail: if network down or payload malformed, returns null.
 */

export type WeatherCondition = 'rain' | 'snow' | 'cloud' | 'clear' | 'storm' | 'unknown'

export interface OutsideWeather {
  tempC: number
  description: string
  condition: WeatherCondition
}

export type WeatherFetcher = () => Promise<any>

export const wttrFetcher: WeatherFetcher = async () => {
  const res = await fetch('https://wttr.in/?format=j1', {
    headers: { 'User-Agent': 'hi-introvert/1.2' },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`wttr.in returned ${res.status}`)
  return res.json()
}

export async function fetchWeather(fetcher: WeatherFetcher = wttrFetcher): Promise<OutsideWeather | null> {
  try {
    const data = await fetcher()
    const current = data?.current_condition?.[0]
    if (!current) return null
    const description: string = current.weatherDesc?.[0]?.value ?? 'Unknown'
    const tempC = Number(current.temp_C)
    if (!Number.isFinite(tempC)) return null
    return { tempC, description, condition: classifyCondition(description) }
  } catch {
    return null
  }
}

function classifyCondition(desc: string): WeatherCondition {
  const d = desc.toLowerCase()
  if (d.includes('thunder') || d.includes('storm')) return 'storm'
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return 'rain'
  if (d.includes('snow') || d.includes('sleet')) return 'snow'
  if (d.includes('cloud') || d.includes('overcast')) return 'cloud'
  if (d.includes('clear') || d.includes('sun')) return 'clear'
  return 'unknown'
}
