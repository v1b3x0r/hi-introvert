import { test, expect, describe } from 'bun:test'
import { fetchWeather } from '../src/sensors/OutsideWeatherSensor'

describe('OutsideWeatherSensor', () => {
  test('parses wttr.in current_condition payload', async () => {
    const fakeFetch = async () => ({
      current_condition: [{
        temp_C: '24',
        weatherDesc: [{ value: 'Light rain' }],
      }],
    })
    const result = await fetchWeather(fakeFetch)
    expect(result).toEqual({
      tempC: 24,
      description: 'Light rain',
      condition: 'rain',
    })
  })

  test('classifies clear condition', async () => {
    const fakeFetch = async () => ({
      current_condition: [{ temp_C: '30', weatherDesc: [{ value: 'Sunny' }] }],
    })
    const result = await fetchWeather(fakeFetch)
    expect(result?.condition).toBe('clear')
  })

  test('silently returns null on fetch error', async () => {
    const failingFetch = async () => { throw new Error('network down') }
    const result = await fetchWeather(failingFetch)
    expect(result).toBeNull()
  })

  test('returns null when payload malformed', async () => {
    const badFetch = async () => ({ current_condition: [] })
    const result = await fetchWeather(badFetch)
    expect(result).toBeNull()
  })

  test('returns null when temp_C not numeric', async () => {
    const badFetch = async () => ({
      current_condition: [{ temp_C: 'N/A', weatherDesc: [{ value: 'Foggy' }] }],
    })
    const result = await fetchWeather(badFetch)
    expect(result).toBeNull()
  })
})
