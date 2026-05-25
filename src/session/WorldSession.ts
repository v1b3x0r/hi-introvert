/**
 * Hi-Introvert: World Session
 *
 * Manages world state and entity interactions:
 * - Loads .mdm files for entity definitions
 * - Tracks vocabulary, growth, and conversation context
 * - Supports save/load sessions
 * - Emits events for UI integration
 * - Cultivates companion growth through interaction
 */

import {
  World,
  Entity,
  EmotionalState,
  toWorldFile,
  fromWorldFile,
  Environment,
  Weather,
  EnergySystem,
  initializeThermalProperties,
  DialogueManager,
  MemoryConsolidation,
  SymbolicPhysicalCoupler,
  CollectiveIntelligence,
  clusterBySimilarity,
  MemoryLog,
  createMemoryLog,
  TrustSystem
} from '@v1b3x0r/mds-core'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { VocabularyTracker } from '../vocabulary/VocabularyTracker.js'
import { ContextAnalyzer} from './ContextAnalyzer.js'
import { MemoryPromptBuilder } from './MemoryPromptBuilder.js'
import { GrowthTracker } from './GrowthTracker.js'
import { ProtoLanguageGenerator } from '@v1b3x0r/mds-core'
import { OSSensor } from '../sensors/OSSensor.js'
import { dedupeSpeak } from '../utils/dedupe-speak.js'
import { computeMoonPhase } from '../sensors/MoonSensor.js'
import { readLocalContext } from '../sensors/LocalContextSensor.js'
import { fetchWeather } from '../sensors/OutsideWeatherSensor.js'
import { detectChargerTransition, transitionSalience } from '../utils/charger-transition.js'
import { boostedTokensFromMemories } from '../utils/memory-tokens.js'
import { pickFromMDM } from '../utils/pick-from-mdm.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Load .mdm file from entities directory
 * Works both in development (src/) and production (dist/)
 */
function loadMDM(filename: string): any {
  // Try production path first (dist/../entities)
  let mdmPath = path.join(__dirname, '../entities', filename)

  // Fallback to development path (src/../../entities)
  if (!fs.existsSync(mdmPath)) {
    mdmPath = path.join(__dirname, '../../entities', filename)
  }

  const content = fs.readFileSync(mdmPath, 'utf-8')
  return JSON.parse(content)
}

// Load MDM definitions from files
const companionMDM = loadMDM('companion.mdm')
const travelerMDM = loadMDM('traveler.mdm')

export interface EntityInfo {
  name: string
  entity: Entity
  previousValence: number
}

export interface MessageResponse {
  name: string
  response: string
  emotion: EmotionalState
  previousValence: number
  newWordsLearned?: string[]
}

export class WorldSession extends EventEmitter {
  world: World
  entities: Map<string, EntityInfo> = new Map()

  // Impersonation: user controls one entity
  impersonatedEntity!: EntityInfo  // traveler (controlled by user)
  companionEntity!: EntityInfo     // companion (autonomous AI)

  // Growth tracking (vocabulary, concepts)
  vocabularyTracker: VocabularyTracker
  contextAnalyzer: ContextAnalyzer
  promptBuilder: MemoryPromptBuilder
  growthTracker: GrowthTracker
  protoLangGenerator: ProtoLanguageGenerator  // v6.1: Emergent language
  autoSaveEnabled: boolean = false  // v6.3: Disabled - BlessedApp handles save with history
  silentMode: boolean = false  // v6.3: Disable console.log for TUI mode

  // v1.1.2: Track last spoken lines per (entity, category) to dedupe MDM dialogue
  private recentSpoken: Map<string, string[]> = new Map()

  // v1.2: Privacy toggles for ambient external sensors
  privacySettings = {
    outsideWeatherEnabled: true,
    localContextEnabled: true,
  }

  // v1.2.1: Track last-seen charger state for transition detection
  private _lastCharging: boolean | null = null

  /**
   * Anti-repeat wrapper for entity.speak() — works around mds-core's
   * tendency to pick the same dialogue line repeatedly.
   */
  private speakDedup(entity: Entity, category: string): string | undefined {
    const key = `${entity.name}:${category}`
    const recent = this.recentSpoken.get(key) ?? []
    const { line, updatedRecent } = dedupeSpeak(() => entity.speak(category), recent)
    this.recentSpoken.set(key, updatedRecent)
    return line
  }

  // v5.7.1: Chat trigger context tracking
  lastMessageTime: number = Date.now()

  // v6.2: Environment System
  environment: Environment                     // MDS environment (temperature, light, humidity)
  osSensor: OSSensor                          // OS metrics → environment mapping
  weather: Weather                            // Weather system (rain, wind, clouds)
  energySystem: EnergySystem                  // Thermal energy transfer

  // v6.2: Communication & Cognition
  dialogueManager: DialogueManager            // Branching conversations
  memoryConsolidation: MemoryConsolidation    // Memory merging & forgetting

  // v6.2: Advanced Systems (Tasks 8-14)
  coupler: SymbolicPhysicalCoupler            // Emotion → physics coupling
  worldMind: CollectiveIntelligence           // Population analytics
  memoryLogs: Map<string, MemoryLog>          // CRDT-based distributed memory (Task 8)
  trustSystems: Map<string, TrustSystem>      // Trust & Privacy per entity (Task 9)

  constructor() {
    super()  // Call EventEmitter constructor
    // Initialize World with full features + LLM
    this.world = new World({
      features: {
        ontology: true,
        communication: true,
        cognition: true,         // v5.5: Enable P2P cognition for entity-to-entity
        history: true,
        linguistics: true,
        rendering: 'headless'
      },
      linguistics: {
        analyzeEvery: 30,
        minUsage: 3,
        maxTranscript: 500
      },
      llm: {
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_KEY,
        languageModel: 'anthropic/claude-3.5-sonnet'
      }
    })

    // Initialize growth systems
    this.vocabularyTracker = new VocabularyTracker()
    this.contextAnalyzer = new ContextAnalyzer()
    this.promptBuilder = new MemoryPromptBuilder()
    this.growthTracker = new GrowthTracker()
    this.protoLangGenerator = new ProtoLanguageGenerator({
      minVocabularySize: 50,  // v1.1.0: Increased from 20 to 50 for smoother proto-language
      maxPhraseLength: 8,
      emotionInfluence: 0.7,
      fallbackToDialogue: true
    })

    // v6.2: Initialize environment system
    this.environment = new Environment({
      baseTemperature: 293,    // Start at 20°C
      baseHumidity: 0.5,       // Moderate
      baseLight: 0.8,          // Bright
      windVelocity: { vx: 0, vy: 0 },
      timeScale: 0             // Static (OS sensors drive changes)
    })
    this.osSensor = new OSSensor()

    // v6.2: Initialize weather system (variable preset)
    this.weather = new Weather({
      rainProbability: 0.15,
      rainDuration: 40,
      maxRainIntensity: 0.8,
      windVariation: 0.5
    })

    // v6.2: Initialize energy system
    this.energySystem = new EnergySystem({
      thermalTransferRate: 0.1,
      environmentCoupling: 0.05
    })

    // v6.2: Initialize dialogue + memory systems
    this.dialogueManager = new DialogueManager()
    this.memoryConsolidation = new MemoryConsolidation({
      similarityThreshold: 0.7,
      forgettingRate: 0.001,
      consolidationInterval: 60000  // 1 minute
    })

    // v6.2: Initialize advanced systems (Tasks 8-14)
    this.coupler = new SymbolicPhysicalCoupler({
      arousalToSpeed: 0.5,
      valenceToMass: 0.3,
      dominanceToForce: 0.4,
      enabled: true
    })
    this.worldMind = new CollectiveIntelligence()
    this.memoryLogs = new Map()  // CRDT memory logs (Task 8)
    this.trustSystems = new Map()  // Trust & Privacy (Task 9)

    // Spawn both entities (both autonomous initially)
    this.spawnCompanion()
    this.spawnTraveler()

    // Auto-impersonate traveler (user controls traveler by default)
    this.impersonate('traveler')

    // v6.1: Setup P2P Cognition between companion and user (traveler)
    this.setupCognitiveLinks()

    // v6.1: Initialize companion skills (personality-driven proficiencies)
    this.initializeCompanionSkills()

    // Setup environment sensors (broadcast events via setInterval)
    this.setupEnvironmentSensors()

    // Auto-tick world
    setInterval(() => {
      this.world.tick(1 / 2)  // 2 FPS
    }, 500)

    // Autosave every 30 seconds
    setInterval(() => {
      if (this.autoSaveEnabled) {
        this.saveSession()
      }
    }, 30000)
  }

  /**
   * Set silent mode (disable console.log for TUI)
   */
  setSilentMode(silent: boolean) {
    this.silentMode = silent
  }

  /**
   * Debug logger (respects silent mode)
   */
  private debug(...args: any[]) {
    if (!this.silentMode) {
      console.log(...args)
    }
  }

  /**
   * Impersonate: User controls an entity
   * Disables autonomous behavior for that entity
   */
  impersonate(entityName: string) {
    const entity = this.entities.get(entityName)
    if (!entity) {
      this.emit('error', { type: 'impersonate', message: `Entity "${entityName}" not found` })
      return
    }

    // Disable autonomous (user controls now)
    entity.entity.disableAutonomous()
    this.impersonatedEntity = entity

    this.emit('impersonate', { entityName })
  }

  /**
   * Unpossess: Release control back to AI
   */
  unpossess() {
    if (!this.impersonatedEntity) return

    const entityName = this.impersonatedEntity.name

    // Re-enable autonomous
    this.impersonatedEntity.entity.enableAutonomous()
    this.emit('unpossess', { entityName })

    this.impersonatedEntity = null as any  // Reset (but keep reference for type safety)
  }

  /**
   * Spawn companion entity (AI, autonomous)
   */
  private spawnCompanion() {
    this.companionEntity = this.spawnEntity('companion', companionMDM)
  }

  /**
   * Spawn traveler entity (AI, autonomous, but will be impersonated by user)
   */
  private spawnTraveler() {
    this.impersonatedEntity = this.spawnEntity('traveler', travelerMDM)
  }

  /**
   * Generic entity spawn helper
   */
  private spawnEntity(name: string, material: any): EntityInfo {
    // Spawn entity at random position
    const x = 50 + Math.random() * 100
    const y = 50 + Math.random() * 100
    const entity = this.world.spawn(material, x, y)

    // Enable all features (autonomous by default)
    entity.enable('memory', 'learning', 'relationships', 'skills')  // v6.1: Added skills
    entity.enableAutonomous()

    // v6.2: Initialize thermal properties
    initializeThermalProperties(
      entity,
      293,   // 20°C default temperature
      0.5,   // 50% humidity
      1.0,   // Normal density
      0.5    // Medium conductivity
    )

    // Remember own identity
    const essence = typeof material.essence === 'string'
      ? material.essence
      : material.essence?.th || material.essence?.en || 'An entity'

    entity.remember({
      type: 'spawn',
      subject: 'self',
      content: { name, essence },
      timestamp: Date.now(),
      salience: 1.0
    })

    // v6.2: Create CRDT memory log for this entity (Task 8)
    const memoryLog = createMemoryLog(entity.uuid)
    this.memoryLogs.set(entity.uuid, memoryLog)

    // v6.2: Create Trust & Privacy system for this entity (Task 9)
    const trustSystem = new TrustSystem({
      initialTrust: 0.5,
      trustThreshold: 0.6
    })
    // Default: share emotions publicly, memories need trust
    trustSystem.setSharePolicy('emotion', 'public')
    trustSystem.setSharePolicy('memory', 'trust')
    this.trustSystems.set(entity.uuid, trustSystem)

    const entityInfo: EntityInfo = {
      name,
      entity,
      previousValence: entity.emotion.valence
    }

    this.entities.set(name, entityInfo)
    return entityInfo
  }

  /**
   * Setup environment sensors using broadcastEvent pattern
   *
   * Instead of dedicated sensor API, we use:
   * setInterval → world.broadcastEvent → entity.inbox
   */
  private setupEnvironmentSensors() {
    // Sensors broadcast to all entities in world
    // (not specific to one entity)

    // System context (broadcast once on startup)
    this.world.broadcastEvent('system_context', {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      context: 'terminal'
    })

    // Time-of-day sensor (broadcast every 30 seconds)
    setInterval(() => {
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()

      let timeOfDay = 'night'
      if (hour >= 5 && hour < 12) timeOfDay = 'morning'
      else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
      else if (hour >= 17 && hour < 21) timeOfDay = 'evening'

      this.world.broadcastEvent('time_update', {
        hour,
        minute,
        timeOfDay,
        timestamp: now.toISOString()
      })

      // Entities have 10% chance to notice time passing
      for (const entityInfo of this.entities.values()) {
        if (entityInfo.entity.memory && Math.random() < 0.1) {
          entityInfo.entity.remember({
            type: 'observation',
            subject: 'time',
            content: { timeOfDay, hour },
            timestamp: Date.now(),
            salience: 0.2
          })
        }
      }
    }, 30000)

    // Session duration (broadcast every 5 minutes)
    const startTime = Date.now()
    setInterval(() => {
      const duration = Date.now() - startTime
      const minutes = Math.floor(duration / 60000)

      if (minutes > 0) {
        this.world.broadcastEvent('session_duration', {
          duration,
          minutes
        })

        // Entities notice long conversation
        for (const entityInfo of this.entities.values()) {
          if (entityInfo.entity.memory && minutes % 5 === 0) {
            entityInfo.entity.remember({
              type: 'observation',
              subject: 'conversation',
              content: { duration: `${minutes} minutes` },
              timestamp: Date.now(),
              salience: 0.3
            })
          }
        }
      }
    }, 300000)  // 5 minutes

    // v6.2: Longing field check (every 2 minutes)
    // Companion may miss traveler if high familiarity but no recent interaction
    setInterval(() => {
      this.spawnLongingField(this.companionEntity, 'traveler')
    }, 120000)  // 2 minutes

    // v6.2: OS Environment sensor (update every 10 seconds)
    setInterval(() => {
      const metrics = this.osSensor.getMetrics()
      const envMapping = this.osSensor.mapToEnvironment(metrics)

      // Update MDS Environment dynamically
      this.environment['config'].baseTemperature = envMapping.temperature
      this.environment['config'].baseHumidity = envMapping.humidity
      this.environment['config'].baseLight = envMapping.light
      this.environment['config'].windVelocity = {
        vx: envMapping.windVx,
        vy: envMapping.windVy
      }

      // Broadcast environment change event
      this.world.broadcastEvent('environment_update', {
        temperature: envMapping.temperature,
        humidity: envMapping.humidity,
        light: envMapping.light,
        wind: { vx: envMapping.windVx, vy: envMapping.windVy }
      })

      // Emit for monitoring
      this.emit('environment', {
        metrics,
        mapping: envMapping
      })

      // v1.2.1: Charger transition (plug = arrival, unplug = departure)
      const transition = detectChargerTransition(
        this._lastCharging,
        { charging: metrics.batteryCharging, batteryLevel: metrics.batteryLevel },
      )
      if (transition) {
        this.world.broadcastEvent('charging_change', transition)
        this.emit('charging_change', transition)
        const salience = transitionSalience(transition)
        for (const ei of this.entities.values()) {
          if (ei.entity.memory && Math.random() < 0.3) {
            ei.entity.remember({
              type: 'observation',
              subject: transition.connected ? 'arrival' : 'departure',
              content: transition,
              timestamp: Date.now(),
              salience,
            })
          }
        }
      }
      this._lastCharging = metrics.batteryCharging
    }, 10000)  // 10 seconds

    // v6.2: Weather system update (every 2 seconds)
    setInterval(() => {
      // Update weather state
      this.weather.update(2)  // 2 seconds dt

      const weatherState = this.weather.getState()

      // Weather affects environment
      if (weatherState.rain) {
        // Rain increases humidity, reduces light (cloud cover)
        this.environment['config'].baseHumidity = Math.min(1, this.environment['config'].baseHumidity + weatherState.rainIntensity * 0.3)
        this.environment['config'].baseLight = Math.max(0.2, this.environment['config'].baseLight * (1 - weatherState.cloudCover))

        // Wind multiplier
        const windMult = weatherState.windStrength
        this.environment['config'].windVelocity = {
          vx: this.environment['config'].windVelocity.vx * windMult,
          vy: this.environment['config'].windVelocity.vy * windMult
        }

        // Broadcast rain event
        this.world.broadcastEvent('weather_rain', {
          intensity: weatherState.rainIntensity,
          cloudCover: weatherState.cloudCover,
          windStrength: weatherState.windStrength
        })

        // Emit for monitoring
        this.emit('weather', {
          type: 'rain',
          intensity: weatherState.rainIntensity,
          cloudCover: weatherState.cloudCover
        })

        // Rain affects emotion (slightly negative valence, calm arousal)
        for (const entityInfo of this.entities.values()) {
          const entity = entityInfo.entity
          entity.emotion = {
            valence: Math.max(-1, entity.emotion.valence - 0.05 * weatherState.rainIntensity),
            arousal: Math.max(0, entity.emotion.arousal - 0.03 * weatherState.rainIntensity),
            dominance: entity.emotion.dominance
          }
        }
      }
    }, 2000)  // 2 seconds

    // v6.2: Memory Consolidation (every 1 minute)
    setInterval(() => {
      const companion = this.companionEntity.entity

      // Consolidate companion memories
      if (companion.memory?.memories && companion.memory.memories.length > 5) {
        const consolidated = this.memoryConsolidation.consolidate(companion.memory.memories)

        if (consolidated.length > 0) {
          this.emit('memory-consolidation', {
            entity: 'companion',
            count: consolidated.length,
            strongest: consolidated.slice(0, 3).map((m: any) => ({
              subject: m.subject,
              strength: m.strength.toFixed(2),
              rehearsals: m.rehearsalCount
            }))
          })
        }
      }

      // Apply forgetting curve
      this.memoryConsolidation.applyForgetting(60)  // 60 seconds

      // v6.2: Trust decay (Task 9)
      for (const trustSystem of this.trustSystems.values()) {
        trustSystem.decayTrust(60)  // 60 seconds decay
      }
    }, 60000)  // 1 minute

    // v6.2: Energy + Collision system (every 1 second)
    setInterval(() => {
      const allEntities = Array.from(this.entities.values()).map(info => info.entity)

      // 1. Check for collision (proximity-based, headless mode)
      const companion = this.companionEntity.entity
      const traveler = this.impersonatedEntity.entity

      const dx = traveler.x - companion.x
      const dy = traveler.y - companion.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      const collisionRadius = 50  // Entities "collide" when < 50px apart

      if (distance < collisionRadius) {
        // Collision detected!
        this.emit('collision', {
          entities: ['companion', 'traveler'],
          distance: distance.toFixed(1)
        })

        // Broadcast collision event
        this.world.broadcastEvent('entity_collision', {
          a: 'companion',
          b: 'traveler',
          distance
        })
      }

      // 2. Energy transfer (entity-to-entity thermal exchange)
      this.energySystem.updateEntityTransfer(allEntities, 1)  // 1 second dt

      // 3. Energy transfer (environment coupling)
      this.energySystem.updateEnvironmentTransfer(allEntities, this.environment, 1)

      // 4. Apply emotion → physics coupling (Task 10)
      for (const entity of allEntities) {
        const physProps = this.coupler.emotionToPhysics(entity.emotion)

        // Apply physics properties to entity movement
        if (physProps && physProps.speed !== undefined) {
          // Random drift based on emotion-modulated speed
          const baseSpeed = 2  // pixels per second
          const emotionalSpeed = baseSpeed * physProps.speed

          // Random walk with emotional influence
          const angle = Math.random() * Math.PI * 2
          const dx = Math.cos(angle) * emotionalSpeed
          const dy = Math.sin(angle) * emotionalSpeed

          // Update position (bounded to world size)
          entity.x = Math.max(0, Math.min(800, entity.x + dx))
          entity.y = Math.max(0, Math.min(600, entity.y + dy))

          // Store for monitoring
          entity['_physProps'] = physProps
        }
      }

      // 5. Emit thermal state for monitoring (every 5 updates = 5 seconds)
      if (Date.now() % 5000 < 1000) {
        this.emit('thermal', {
          companion: {
            temperature: (companion.temperature - 273).toFixed(1) + '°C',
            humidity: ((companion.humidity || 0) * 100).toFixed(0) + '%'
          },
          traveler: {
            temperature: (traveler.temperature - 273).toFixed(1) + '°C',
            humidity: ((traveler.humidity || 0) * 100).toFixed(0) + '%'
          }
        })
      }
    }, 1000)  // 1 second

    // v6.2: World Mind analytics (every 30 seconds) - Task 12
    setInterval(() => {
      const allEntities = Array.from(this.entities.values()).map(info => info.entity)

      // Use static methods
      const stats = CollectiveIntelligence.calculateStats(allEntities)
      const patterns = CollectiveIntelligence.detectPatterns(allEntities)
      const collectiveEmotion = CollectiveIntelligence.calculateCollectiveEmotion(allEntities)

      this.emit('world-mind', {
        stats,
        patterns,
        collectiveEmotion
      })
    }, 30000)

    // v1.2: Moon phase sensor (every hour, pure compute)
    setInterval(() => {
      const moon = computeMoonPhase()
      this.world.broadcastEvent('lunar_phase', moon)
      this.emit('lunar_phase', moon)
      for (const ei of this.entities.values()) {
        if (ei.entity.memory && Math.random() < 0.15) {
          ei.entity.remember({
            type: 'observation',
            subject: 'moon',
            content: moon,
            timestamp: Date.now(),
            salience: 0.5,
          })
        }
      }
    }, 60 * 60 * 1000)

    // v1.2: Local context sensor (every 30s, no network)
    setInterval(() => {
      if (!this.privacySettings.localContextEnabled) return
      const ctx = readLocalContext()
      this.world.broadcastEvent('local_context', ctx)
      this.emit('local_context', ctx)
      for (const ei of this.entities.values()) {
        if (ei.entity.memory && Math.random() < 0.1) {
          ei.entity.remember({
            type: 'observation',
            subject: 'environment',
            content: ctx,
            timestamp: Date.now(),
            salience: 0.1,
          })
        }
      }
    }, 30 * 1000)

    // v1.2: Outside weather sensor (every 10min, silent network fail)
    setInterval(async () => {
      if (!this.privacySettings.outsideWeatherEnabled) return
      const weather = await fetchWeather()
      if (!weather) return
      this.world.broadcastEvent('outside_weather', weather)
      this.emit('outside_weather', weather)
      for (const ei of this.entities.values()) {
        if (ei.entity.memory && Math.random() < 0.2) {
          ei.entity.remember({
            type: 'observation',
            subject: 'weather',
            content: weather,
            timestamp: Date.now(),
            salience: 0.3,
          })
        }
      }
    }, 10 * 60 * 1000)
  }


  /**
   * Get all entities (for UI)
   */
  getAllEntities(): EntityInfo[] {
    return Array.from(this.entities.values())
  }

  /**
   * Get entity info (backwards compat - returns companion entity)
   */
  getEntityInfo(): EntityInfo | null {
    return this.companionEntity || null
  }

  /**
   * Get entity greeting (on session start)
   * Companion greets the user (who controls traveler)
   */
  getGreeting(): string {
    const entity = this.companionEntity.entity

    // Check if companion remembers traveler (returning visitor)
    const travelerMemories = entity.memory?.recall({ subject: 'traveler' }) || []

    if (travelerMemories.length === 0) {
      // First meeting - use intro dialogue
      return this.speakDedup(entity, 'intro') || 'Hi...'
    } else {
      // Returning visitor - use greeting_familiar
      const greeting = this.speakDedup(entity, 'greeting_familiar') || 'Welcome back!'
      return greeting
    }
  }

  /**
   * Handle user message
   * User "speaks through" impersonated traveler → companion responds
   */
  async handleUserMessage(message: string): Promise<MessageResponse> {
    const traveler = this.impersonatedEntity.entity
    const companion = this.companionEntity.entity

    // 0. v5.7.1: Update trigger context for emotion triggers
    const now = Date.now()
    const silenceDuration = this.lastMessageTime
      ? (now - this.lastMessageTime) / 1000
      : 0

    companion.updateTriggerContext({
      userMessage: message,
      userSilenceDuration: silenceDuration
    })

    // Check emotion triggers (MDM-defined transitions)
    companion.checkEmotionTriggers()

    this.lastMessageTime = now

    // 1. Detect new words (companion learns from traveler's speech)
    const newWords = this.vocabularyTracker.detectNewWords(message)
    if (newWords.length > 0) {
      this.emit('vocab', { words: newWords })

      // Companion acknowledges learning
      for (const word of newWords.slice(0, 2)) {  // Max 2 words at once
        companion.remember({
          type: 'observation',
          subject: 'vocabulary',
          content: { word, source: 'traveler' },
          timestamp: Date.now(),
          salience: 0.6
        })
      }
    }

    // 2. Analyze context (from companion's perspective)
    const context = this.contextAnalyzer.analyzeIntent(message, companion)

    // 3. Apply emotion hint to companion (traveler's message affects companion's emotion)
    if (context.emotionHint) {
      const current = companion.emotion
      companion.emotion = {
        valence: (current.valence + context.emotionHint.valence) / 2,
        arousal: (current.arousal + context.emotionHint.arousal) / 2,
        dominance: current.dominance
      }
    }

    // 4. Traveler "speaks" (controlled by user)
    if (traveler.memory) {
      traveler.remember({
        type: 'interaction',
        subject: this.companionEntity.name,
        content: { message, intent: context.intent },
        timestamp: Date.now(),
        salience: 0.7
      })
    }

    // 5. Companion remembers traveler's message
    companion.remember({
      type: 'interaction',
      subject: 'traveler',
      content: { message, intent: context.intent },
      timestamp: Date.now(),
      salience: 0.7
    })

    // 6. Form/reinforce cognitive link (entity-to-entity)
    if (companion.cognitiveLinks && traveler.cognitiveLinks) {
      companion.connectTo(traveler, { strength: 0.7, bidirectional: true })
      this.emit('link', {
        from: this.companionEntity.name,
        to: this.impersonatedEntity.name,
        strength: 0.7
      })
    }

    // 7. Get response from companion
    const response = await this.getEntityResponse(message, context)

    // 8. Companion remembers own response
    companion.remember({
      type: 'interaction',
      subject: 'self',
      content: { response },
      timestamp: Date.now(),
      salience: 0.4
    })

    // 9. Record speech for linguistics
    this.world.recordSpeech(companion, response)

    // 10. Learn from interaction (Q-learning)
    const emotionDelta = companion.emotion.valence - this.companionEntity.previousValence
    if (Math.abs(emotionDelta) > 0.1 && companion.learning) {
      companion.learning.addExperience({
        timestamp: Date.now(),
        action: 'respond',
        context: { intent: context.intent },
        outcome: emotionDelta > 0 ? 'positive' : 'negative',
        reward: emotionDelta,
        success: emotionDelta > 0
      })
    }

    // 11. Update growth tracker
    this.vocabularyTracker.incrementConversation()
    this.growthTracker.update({
      vocabularySize: this.vocabularyTracker.getVocabularySize(),
      conversationCount: this.vocabularyTracker.toJSON().conversationCount,
      memoryCount: companion.memory?.memories?.length || 0
    })

    // Track concepts learned
    for (const keyword of context.keywords) {
      if (keyword.length > 3) {
        this.growthTracker.learnConcept(keyword)
      }
    }

    // 12. Update previous valence
    this.companionEntity.previousValence = companion.emotion.valence

    // 13. v6.2: Check for "sync moment" (emotional alignment)
    // Spawn field if both entities emotionally aligned
    const valenceDiff = Math.abs(companion.emotion.valence - traveler.emotion.valence)
    const arousalDiff = Math.abs(companion.emotion.arousal - traveler.emotion.arousal)
    const alignment = 1 - (valenceDiff + arousalDiff) / 2

    if (alignment > 0.6) {  // High alignment threshold
      this.spawnSyncMoment(this.companionEntity, this.impersonatedEntity)
    }

    return {
      name: this.companionEntity.name,
      response,
      emotion: { ...companion.emotion },
      previousValence: this.companionEntity.previousValence,
      newWordsLearned: newWords
    }
  }

  /**
   * Get entity response (MDM dialogue first, LLM fallback)
   * Companion responds to traveler's message
   */
  private async getEntityResponse(
    userMessage: string,
    context: ReturnType<ContextAnalyzer['analyzeIntent']>
  ): Promise<string> {
    const entity = this.companionEntity.entity

    // 1. Try MDM dialogue first (based on intent)
    let response: string | undefined

    // Map intent to dialogue categories (expanded for better variety)
    const categoryMap: Record<string, string> = {
      'greeting': 'intro',
      'praise': 'happy',
      'criticism': 'sad',
      'question': 'thinking',
      'farewell': 'intro',
      'curiosity': 'curious',
      'excitement': 'excited',
      'confusion': 'confused',
      'neutral': 'self_monologue',
      'introspection': 'self_monologue'
    }

    // v1.2.2: When the user asks a question AND the companion has a memory
    // matching it, skip mds-core's hardcoded category fallbacks ("นั่นอะไร?",
    // "*เอียงหัว*", etc.) and let proto-language compose a reply using the
    // memory-boosted vocabulary pool. Aligns with v6.3 "force proto-language"
    // philosophy — companion should *struggle* to speak from what it knows,
    // not default to canned curiosity.
    const memoryGuidedQuestion =
      context.intent === 'question' && context.relevantMemories.length > 0

    if (!memoryGuidedQuestion) {
      const category = categoryMap[context.intent]
      if (category) {
        response = this.speakDedup(entity, category)
      }
    }

    // If new words learned, acknowledge
    if (!response && !memoryGuidedQuestion && context.keywords.some(k => !this.vocabularyTracker.canUse(k))) {
      response = this.speakDedup(entity, 'learned_new_word')
    }

    // If confused (low memory relevance)
    if (!response && context.relevantMemories.length === 0 && context.intent === 'question') {
      response = this.speakDedup(entity, 'confused')
    }

    // Emotion-based fallback (skip for memory-guided questions)
    if (!response && !memoryGuidedQuestion) {
      const emotion = entity.emotion
      if (emotion.valence > 0.5) {
        response = this.speakDedup(entity, 'happy')
      } else if (emotion.valence < -0.3) {
        response = this.speakDedup(entity, 'sad')
      } else if (emotion.arousal > 0.6) {
        response = this.speakDedup(entity, 'excited')
      } else if (emotion.arousal < 0.3) {
        response = this.speakDedup(entity, 'tired')
      } else {
        response = this.speakDedup(entity, 'curious')
      }
    }

    // v6.1: Proto-language generation (if vocabulary ≥ 20 words)
    // Emergent language from learned vocabulary + crystallized patterns
    // v6.2: Environment-aware (temperature, light, humidity affect word choice)
    if (!response && this.vocabularyTracker.getVocabularySize() >= 20) {
      let vocabularyPool = this.vocabularyTracker.toJSON().knownWords

      // v6.1: Enhance with crystallized patterns (if available)
      if (this.world.lexicon) {
        const patterns = this.world.lexicon.getAll()
        if (patterns.length > 0) {
          // Add high-weight patterns to vocabulary pool
          const frequentPatterns = patterns
            .filter(p => p.weight > 0.3)  // Only frequent patterns
            .map(p => p.phrase)
          vocabularyPool = [...vocabularyPool, ...frequentPatterns]
        }
      }

      // v6.2: Get environment state at entity position
      const envState = this.environment.getState(entity.x, entity.y)

      // Add environment-based vocabulary modifiers
      const tempCelsius = envState.temperature - 273
      if (tempCelsius > 30) vocabularyPool.push('ร้อน', 'hot', '🥵')
      else if (tempCelsius < 15) vocabularyPool.push('หนาว', 'cold', '🥶')

      if (envState.humidity > 0.7) vocabularyPool.push('ชื้น', 'humid', '💧')
      if (envState.light < 0.4) vocabularyPool.push('มืด', 'dark', '🌙')
      else if (envState.light > 0.8) vocabularyPool.push('สว่าง', 'bright', '☀️')

      // v6.2: Weather-based vocabulary
      const weatherState = this.weather.getState()
      if (weatherState.rain) {
        vocabularyPool.push('ฝนตก', 'rain', '🌧️', 'wet', 'เปียก')
        if (weatherState.rainIntensity > 0.7) {
          vocabularyPool.push('heavy rain', 'ฝนหนัก', '⛈️')
        }
      }

      // v1.2.2: Boost tokens from relevant memories so proto-language can
      // surface contextually meaningful words (e.g. user's name).
      // PREPEND, not append: mds-core's generate() only samples from
      // the first 10 elements of the pool, so trailing items never get picked.
      //
      // Filter to fact-like memories (intent statement/teaching/greeting),
      // not question memories — otherwise repeated "what is X?" turns store
      // self-referential question memories that drown out the actual answer
      // memory in the relevance ranking.
      // Recall fact memories directly so we don't get truncated by
      // ContextAnalyzer's top-5 limit (which fills with question memories
      // after long Q-and-A sessions).
      const allTravelerMemories = (entity.memory?.recall?.() ?? [])
        .filter((m: any) => m?.subject === 'traveler' && m?.content?.intent !== 'question')
      // Keyword overlap scoring against the current question
      const factMemories = allTravelerMemories
        .map((m: any) => {
          const content = JSON.stringify(m.content ?? '').toLowerCase()
          let score = 0
          for (const k of context.keywords) {
            if (content.includes(k)) score += 1
          }
          return { m, score: score * (m.salience ?? 0.5) }
        })
        .filter((x: any) => x.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 5)
        .map((x: any) => x.m)

      if (factMemories.length > 0) {
        vocabularyPool = [
          ...boostedTokensFromMemories(factMemories, 8),
          ...vocabularyPool,
        ]
      }

      // mds-core's generateResponse() filters the pool aggressively when the
      // user asks a question (only keeps think/know/maybe words), which
      // strips our memory boost. For memory-guided questions we call the
      // unfiltered generate() so memory tokens have a chance to surface.
      if (memoryGuidedQuestion) {
        // Skip emotion filter — keeps our memory boost in the first-10
        // sampling window. Also skip greeting/thinking filters that
        // generateResponse() applies.
        response = (this.protoLangGenerator as any).generate({
          vocabularyPool,
          emotion: undefined,
          minWords: 2,
          maxWords: 4,
          allowParticles: true,
          allowEmoji: false,
          creativity: 0.3,  // lower mutation so the name stays recognizable
        })
      } else {
        response = this.protoLangGenerator.generateResponse(userMessage, {
          vocabularyPool,
          emotion: entity.emotion,
          minWords: 1,
          maxWords: 4,
          allowParticles: true,
          allowEmoji: true,
          creativity: 0.6  // High creativity for emergent language
        })
      }

      // Log proto-language event
      if (response) {
        this.emit('proto-lang', {
          message: response,
          vocabularySize: vocabularyPool.length,
          environment: {
            temperature: tempCelsius.toFixed(1) + '°C',
            humidity: (envState.humidity * 100).toFixed(0) + '%',
            light: (envState.light * 100).toFixed(0) + '%'
          }
        })
      }
    }

    // 2. LLM fallback (if no MDM dialogue matched)
    if (!response && this.world.languageGenerator) {
      try {
        this.emit('llm', { action: 'fallback' })

        const prompt = this.promptBuilder.buildPrompt(
          entity,
          userMessage,
          context,
          this.vocabularyTracker
        )

        const llmResponse = await this.world.languageGenerator.generate({
          speaker: entity,
          context: prompt
        })

        response = llmResponse.text
      } catch (error) {
        this.emit('error', { type: 'llm', message: error instanceof Error ? error.message : String(error) })
        response = this.speakDedup(entity, 'intro') || '...'
      }
    }

    // 3. Final fallback (generic)
    if (!response) {
      response = this.speakDedup(entity, 'intro') || '...'
    }

    return response
  }

  /**
   * Spawn new entity friend (LLM-generated essence)
   * Only available when LLM is configured
   */
  async spawnFriend(description?: string): Promise<EntityInfo | null> {
    if (!this.world.languageGenerator) {
      return null  // LLM not available
    }

    // Build prompt for LLM to generate entity essence
    const prompt = description
      ? `Create a companion entity for a chat space. Description: "${description}"\n\nGenerate a JSON object with:\n- essence (Thai + English description of personality)\n- languageProfile (native language + weights)\n- emotion.base (initial valence/arousal/dominance)\n- dialogue (intro, greeting, confused, etc.)\n\nBe creative and make them interesting!`
      : `Create a new companion entity that would be a good friend for an INTP kid. Make them different but complementary.\n\nGenerate a JSON object following the same format as companion.mdm.`

    try {
      const response = await this.world.languageGenerator.generate({
        speaker: this.primaryEntity.entity,
        context: prompt
      })

      // Parse LLM response as JSON
      const generatedData = JSON.parse(response.text)

      // Merge with defaults
      const material = {
        $schema: 'mdspec/v5.7',
        material: `entity.friend_${Date.now()}`,
        ...generatedData
      }

      // Spawn entity
      const entity = this.world.spawn(material, 200, 200)
      const name = generatedData.essence?.en?.split(' ')[0] || `Friend${this.entities.size + 1}`

      entity.enable('memory', 'learning', 'relationships')
      entity.enableAutonomous()  // v5.6: New friend also autonomous

      const entityInfo: EntityInfo = {
        name,
        entity,
        previousValence: entity.emotion.valence
      }

      this.entities.set(name, entityInfo)

      // Primary entity remembers meeting new friend
      if (this.primaryEntity.entity.memory) {
        this.primaryEntity.entity.remember({
          type: 'interaction',
          subject: name,
          content: { action: 'met', essence: generatedData.essence },
          timestamp: Date.now(),
          salience: 0.8
        })
      }

      return entityInfo
    } catch (error) {
      if (!this.silentMode) console.error('[Spawn Error]', error)
      return null
    }
  }

  /**
   * Generate autonomous message from companion
   * Companion speaks spontaneously (self-monologue)
   */
  async generateAutonomousMessage(): Promise<{
    name: string
    response: string
    emotion: EmotionalState
  } | null> {
    const companion = this.companionEntity.entity

    // Check if autonomous
    if (!companion.isAutonomous()) {
      return null
    }

    // v1.2.4: Bypass mds-core's entity.speak() for self_monologue —
    // it deterministically picks the first matching language line (see
    // mds-core #10), so dedupeSpeak's retry loop can't escape the loop.
    // Read companion.mdm directly and sample with non-recent preference.
    let response: string | undefined
    {
      const key = `${companion.name}:self_monologue:mdm`
      const recent = this.recentSpoken.get(key) ?? []
      const picked = pickFromMDM(companionMDM, 'self_monologue', recent)
      if (picked) {
        response = picked
        this.recentSpoken.set(key, [...recent, picked].slice(-6))
      }
    }
    // Last-resort: try the engine's speak() (will hit fallback set if MDM empty)
    if (!response) response = this.speakDedup(companion, 'self_monologue')

    // Fallback: emotion-based self-talk
    if (!response) {
      const emotion = companion.emotion
      if (emotion.valence > 0.5) {
        response = this.speakDedup(companion, 'happy')
      } else if (emotion.valence < -0.3) {
        response = this.speakDedup(companion, 'sad')
      } else {
        response = this.speakDedup(companion, 'curious')
      }
    }

    // Last resort: proto-language (if vocabulary enough)
    if (!response && this.vocabularyTracker.getVocabularySize() >= 20) {
      let vocabularyPool = this.vocabularyTracker.toJSON().knownWords

      // Add crystallized patterns
      if (this.world.lexicon) {
        const patterns = this.world.lexicon.getAll()
        if (patterns.length > 0) {
          const frequentPatterns = patterns
            .filter(p => p.weight > 0.3)
            .map(p => p.phrase)
          vocabularyPool = [...vocabularyPool, ...frequentPatterns]
        }
      }

      // Environment-aware vocabulary
      const envState = this.environment.getState(companion.x, companion.y)
      const tempCelsius = envState.temperature - 273

      if (tempCelsius > 30) vocabularyPool.push('ร้อน', 'hot', '🥵')
      else if (tempCelsius < 15) vocabularyPool.push('หนาว', 'cold', '🥶')

      if (envState.humidity > 0.7) vocabularyPool.push('ชื้น', 'humid', '💧')
      if (envState.light < 0.4) vocabularyPool.push('มืด', 'dark', '🌙')

      const weatherState = this.weather.getState()
      if (weatherState.rain) {
        vocabularyPool.push('ฝนตก', 'rain', '🌧️')
      }

      // Generate proto-language
      response = this.protoLangGenerator.generate(
        companion.emotion,
        vocabularyPool,
        undefined,  // No user message for autonomous
        envState
      )
    }

    // If still no response, skip this cycle
    if (!response) {
      return null
    }

    return {
      name: this.companionEntity.name,
      response,
      emotion: { ...companion.emotion }
    }
  }

  /**
   * Get status summary (both entities)
   */
  getStatusSummary(): string {
    let output = `📊 Status\n\n`

    // Show all entities in world
    for (const entityInfo of this.entities.values()) {
      const entity = entityInfo.entity
      const emotion = entity.emotion
      const memoryCount = entity.memory?.count() || 0

      const isImpersonated = entityInfo === this.impersonatedEntity ? ' (YOU)' : ''
      output += `${entityInfo.name}${isImpersonated}:\n`
      output += `  Emotion: ${emotion.valence.toFixed(2)} (${this.getEmotionWord(emotion)})\n`
      output += `  Arousal: ${emotion.arousal.toFixed(2)}\n`
      output += `  Memories: ${memoryCount}\n\n`
    }

    // Vocabulary stats (shared)
    const vocabStats = this.vocabularyTracker.getStats()
    output += `📚 Vocabulary: ${vocabStats.total} words (+${vocabStats.learnedWords} learned)\n`
    output += `💬 Conversations: ${vocabStats.conversationCount}\n`

    // Linguistics stats
    const lexiconStats = this.world.getLexiconStats()
    if (lexiconStats && lexiconStats.totalTerms > 0) {
      output += `\n🗣️ Linguistics:\n`
      output += `  Terms crystallized: ${lexiconStats.totalTerms}\n`
      output += `  Total usage: ${lexiconStats.totalUsage}\n`
    }

    return output
  }

  /**
   * Get emotion word
   */
  private getEmotionWord(emotion: EmotionalState): string {
    if (emotion.arousal > 0.6) return 'anxious'
    if (emotion.valence > 0.5) return 'happy'
    if (emotion.valence < -0.5) return 'sad'
    if (emotion.valence > 0) return 'calm'
    return 'neutral'
  }

  /**
   * Get growth summary
   */
  getGrowthSummary(): string {
    return this.growthTracker.getSummary()
  }

  /**
   * Save session
   */
  saveSession(filename: string = '.hi-introvert-session.json') {
    const state = {
      vocabulary: this.vocabularyTracker.toJSON(),
      growth: this.growthTracker.toJSON(),
      world: toWorldFile(this.world),
      timestamp: Date.now()
    }

    fs.writeFileSync(filename, JSON.stringify(state, null, 2))
    this.emit('save', { filename })
  }

  /**
   * Save session with conversation history
   */
  saveSessionWithHistory(filename: string = '.hi-introvert-session.json', messages: any[]) {
    const state = {
      vocabulary: this.vocabularyTracker.toJSON(),
      growth: this.growthTracker.toJSON(),
      world: toWorldFile(this.world),
      messages,  // Include conversation history
      privacySettings: this.privacySettings,
      timestamp: Date.now()
    }

    fs.writeFileSync(filename, JSON.stringify(state, null, 2))
    this.emit('save', { filename, messageCount: messages.length })
  }

  /**
   * Load session
   */
  loadSession(filename: string = '.hi-introvert-session.json') {
    if (!fs.existsSync(filename)) {
      this.emit('load', { status: 'not_found', filename })
      return false
    }

    try {
      const data = JSON.parse(fs.readFileSync(filename, 'utf-8'))

      // Restore vocabulary
      this.vocabularyTracker = VocabularyTracker.fromJSON(data.vocabulary)

      // Restore growth
      this.growthTracker = GrowthTracker.fromJSON(data.growth)

      // Restore world (this will restore entity state)
      this.world = fromWorldFile(data.world)

      // Restore entity references
      this.companionEntity.entity = this.world.entities[0]
      this.impersonatedEntity.entity = this.world.entities[1]

      // Restore privacy settings (v1.2)
      if (data.privacySettings) {
        this.privacySettings = { ...this.privacySettings, ...data.privacySettings }
      }

      this.emit('load', {
        status: 'success',
        filename,
        vocabularySize: this.vocabularyTracker.getVocabularySize(),
        entityCount: this.world.entities.length
      })

      return true
    } catch (error) {
      this.emit('error', {
        type: 'load',
        message: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Load session with conversation history
   */
  loadSessionWithHistory(filename: string = '.hi-introvert-session.json'): {
    success: boolean
    messages?: any[]
    vocabularySize?: number
    error?: string
  } {
    if (!fs.existsSync(filename)) {
      return { success: false, error: 'File not found' }
    }

    try {
      const data = JSON.parse(fs.readFileSync(filename, 'utf-8'))

      // Restore vocabulary
      this.vocabularyTracker = VocabularyTracker.fromJSON(data.vocabulary)

      // Restore growth
      this.growthTracker = GrowthTracker.fromJSON(data.growth)

      // Restore world
      this.world = fromWorldFile(data.world)

      // Restore entity references
      this.companionEntity.entity = this.world.entities[0]
      this.impersonatedEntity.entity = this.world.entities[1]

      return {
        success: true,
        messages: data.messages || [],
        vocabularySize: this.vocabularyTracker.getVocabularySize()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Toggle autosave
   */
  toggleAutoSave(): boolean {
    this.autoSaveEnabled = !this.autoSaveEnabled
    return this.autoSaveEnabled
  }

  /**
   * Check if autosave enabled
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSaveEnabled
  }

  /**
   * Get entity info
   */
  getEntityInfo(): EntityInfo {
    return this.entity
  }

  /**
   * Get all events
   */
  getAllEvents() {
    return this.world.events || []
  }

  /**
   * v6.1: Setup P2P Cognitive Links
   * Creates bidirectional cognitive link between companion and traveler
   * Enables emotional resonance and shared awareness
   */
  private setupCognitiveLinks() {
    const companion = this.companionEntity.entity
    const traveler = this.impersonatedEntity.entity

    // Connect companion → traveler (bidirectional)
    companion.connectTo(traveler, {
      strength: 0.7,        // Strong initial connection
      bidirectional: true   // Traveler also connects to companion
    })

    this.debug('v6.1: P2P Cognition enabled (companion ↔ traveler)')
    this.emit('cognitive-link', {
      source: 'companion',
      target: 'traveler',
      strength: 0.7
    })
  }

  /**
   * v6.1: Initialize companion skills
   * Sets up initial skill proficiencies for personality
   */
  private initializeCompanionSkills() {
    const companion = this.companionEntity.entity

    if (!companion.skills) {
      if (!this.silentMode) console.warn('Skills system not enabled for companion')
      return
    }

    // Companion's personality-driven skills
    // (Thai kid who loves thinking, doesn't talk much, but wants to learn)
    companion.skills.addSkill('conversation', {
      proficiency: 0.3,     // Not very talkative yet (novice)
      learningRate: 0.15,   // Learns conversation moderately
      decayRate: 0.002
    })

    companion.skills.addSkill('creativity', {
      proficiency: 0.5,     // Natural creative thinker (competent)
      learningRate: 0.2,    // Learns creativity faster
      decayRate: 0.001
    })

    companion.skills.addSkill('empathy', {
      proficiency: 0.4,     // Shy but empathetic (competent)
      learningRate: 0.1,
      decayRate: 0.0015,
      relatedSkills: ['conversation']  // Empathy helps conversation
    })

    companion.skills.addSkill('learning', {
      proficiency: 0.6,     // Loves learning (proficient)
      learningRate: 0.25,   // Fast learner
      decayRate: 0.0005
    })

    this.debug('v6.1: Companion skills initialized:', {
      conversation: 0.3,
      creativity: 0.5,
      empathy: 0.4,
      learning: 0.6
    })

    this.emit('skills-initialized', {
      entity: 'companion',
      skills: Array.from(companion.skills['skills'].keys())
    })
  }

  /**
   * v6.1: Use crystallized patterns in proto-language
   * Enhances emergent language with discovered patterns
   */
  private enhanceProtoLanguageWithCrystallization() {
    // Trigger crystallization analysis
    if (this.world.lexicon) {
      const patterns = this.world.lexicon.getAll()

      if (patterns.length > 0) {
        this.debug(`v6.1: Crystallized ${patterns.length} linguistic patterns`)
        this.emit('crystallization', {
          patternCount: patterns.length,
          topPatterns: patterns.slice(0, 5).map(p => p.phrase)
        })
      }
    }
  }

  /**
   * v6.2: Spawn "sync moment" field
   * Creates field when conversation resonates (high emotional alignment)
   * Field boosts valence and strengthens relationship
   */
  spawnSyncMoment(sourceEntity: EntityInfo, targetEntity: EntityInfo) {
    const source = sourceEntity.entity
    const target = targetEntity.entity

    // Calculate emotional alignment
    const valenceDiff = Math.abs(source.emotion.valence - target.emotion.valence)
    const arousalDiff = Math.abs(source.emotion.arousal - target.emotion.arousal)
    const alignment = 1 - (valenceDiff + arousalDiff) / 2

    // Only spawn if alignment > 0.5 (emotionally in sync)
    if (alignment < 0.5) return

    // Field spec for "sync moment"
    const fieldSpec = {
      material: 'field.sync_moment',
      type: 'field' as const,
      origin: 'self' as const,
      radius: 200,              // Wide radius (both entities affected)
      duration: 5000,           // 5 seconds
      effect_on_others: {
        valence: 0.3,           // Gentle positive boost
        arousal: 0.1,           // Slight energy increase
        relationshipBoost: 0.5, // Strengthen bond
        sourceEntity: source.material  // Track field source
      }
    }

    // Spawn at source entity position
    this.world.spawnField(fieldSpec, source.x, source.y)

    // v6.2: Update Trust (Task 9) - Positive interaction increases trust
    const sourceTrust = this.trustSystems.get(source.uuid)
    const targetTrust = this.trustSystems.get(target.uuid)

    if (sourceTrust && targetTrust) {
      // Trust boost based on alignment (0.05 to 0.15)
      const trustDelta = alignment * 0.15
      sourceTrust.updateTrust(target.uuid, trustDelta)
      targetTrust.updateTrust(source.uuid, trustDelta)
    }

    // v6.2: CRDT Memory Sync during sync moment (Task 8)
    // When emotionally aligned, entities share memories bidirectionally
    // BUT only if they trust each other (Task 9: Privacy check)
    const sourceLog = this.memoryLogs.get(source.uuid)
    const targetLog = this.memoryLogs.get(target.uuid)

    if (sourceLog && targetLog && sourceTrust && targetTrust) {
      // Check if both entities trust each other enough to share memories
      const sourceCanShare = sourceTrust.shouldShare('memory', target.uuid)
      const targetCanShare = targetTrust.shouldShare('memory', source.uuid)

      if (sourceCanShare && targetCanShare) {
        // Append recent memories to CRDT logs
        if (source.memory?.memories) {
          for (const mem of source.memory.memories.slice(-5)) {  // Last 5 memories
            sourceLog.append(mem)
          }
        }
        if (target.memory?.memories) {
          for (const mem of target.memory.memories.slice(-5)) {  // Last 5 memories
            targetLog.append(mem)
          }
        }

        // Bidirectional merge (CRDT operation)
        const sourceResult = sourceLog.merge(targetLog)
        const targetResult = targetLog.merge(sourceLog)

        if (sourceResult.added > 0 || targetResult.added > 0) {
          this.emit('memory-sync', {
            source: sourceEntity.name,
            target: targetEntity.name,
            sourceAdded: sourceResult.added,
            targetAdded: targetResult.added,
            alignment,
            trusted: true
          })
        }
      } else {
        // Not enough trust to share memories
        this.emit('trust-blocked', {
          source: sourceEntity.name,
          target: targetEntity.name,
          sourceTrust: sourceTrust.getTrust(target.uuid),
          targetTrust: targetTrust.getTrust(source.uuid)
        })
      }
    }

    this.debug(`v6.2: Sync moment (${sourceEntity.name} ↔ ${targetEntity.name}, alignment: ${alignment.toFixed(2)})`)
    this.emit('field', {
      type: 'sync_moment',
      source: sourceEntity.name,
      target: targetEntity.name,
      alignment
    })
  }

  /**
   * v6.2: Spawn "longing" field
   * Creates field when entity misses someone (high familiarity, low recent interaction)
   * Field gently nudges toward reconnection
   */
  spawnLongingField(sourceEntity: EntityInfo, targetEntityName: string) {
    const source = sourceEntity.entity
    const target = this.entities.get(targetEntityName)?.entity

    if (!target) return

    // Check if relationship exists
    const relationship = source.relationships?.get(target.material)
    if (!relationship) return

    // Only spawn if high familiarity but no recent interaction
    const timeSinceLastInteraction = relationship.lastInteraction
      ? Date.now() - relationship.lastInteraction
      : Infinity

    if (relationship.familiarity < 0.5 || timeSinceLastInteraction < 60000) return

    // Field spec for "longing"
    const fieldSpec = {
      material: 'field.longing',
      type: 'field' as const,
      origin: 'self' as const,
      radius: 150,              // Medium radius
      duration: 8000,           // 8 seconds
      effect_on_others: {
        valence: -0.1,          // Slight melancholy
        arousal: -0.05,         // Calm, reflective
        dominance: -0.05,       // Vulnerable
        linkStrength: 0.3,      // Strengthen cognitive link (thinking of them)
        sourceEntity: source.material
      }
    }

    // Spawn at source entity position
    this.world.spawnField(fieldSpec, source.x, source.y)

    this.debug(`v6.2: Longing field (${sourceEntity.name} → ${targetEntityName})`)
    this.emit('field', {
      type: 'longing',
      source: sourceEntity.name,
      target: targetEntityName,
      familiarity: relationship.familiarity
    })
  }
}
