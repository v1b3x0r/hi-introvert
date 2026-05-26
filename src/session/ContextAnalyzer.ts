/**
 * Hi-Introvert: Context Analyzer
 *
 * Analyzes user message to find relevant memories and understand intent
 * Design: Help entity respond contextually (not just emotionally)
 */

import type { Entity } from '@v1b3x0r/mds-core'
import type { Memory } from '@v1b3x0r/mds-core'
import { tokenize } from '../utils/tokenize'

/**
 * User intent types
 */
export type UserIntent =
  | 'question'       // User asks something
  | 'statement'      // User states a fact
  | 'greeting'       // User greets
  | 'emotion'        // User expresses emotion
  | 'teaching'       // User teaches something new
  | 'farewell'       // User says goodbye
  | 'praise'         // User praises entity
  | 'criticism'      // User criticizes entity

/**
 * Context analysis result
 */
export interface ContextAnalysis {
  intent: UserIntent
  context: string
  relevantMemories: Memory[]
  keywords: string[]
  emotionHint?: {
    valence: number   // Expected emotional reaction (-1 to 1)
    arousal: number   // Expected energy level (0 to 1)
  }
}

/**
 * Context Analyzer
 *
 * Analyzes user message to provide context for entity response
 */
export class ContextAnalyzer {
  /**
   * Analyze user message
   *
   * @param message - User input
   * @param entity - Entity that will respond
   * @returns Context analysis
   */
  analyzeIntent(message: string, entity: Entity): ContextAnalysis {
    const normalized = message.toLowerCase().trim()

    // Detect intent
    const intent = this.detectIntent(normalized)

    // Extract keywords
    const keywords = this.extractKeywords(normalized)

    // Find relevant memories
    const relevantMemories = this.findRelevantMemories(entity, keywords)

    // Build context string
    const context = this.buildContext(intent, keywords, relevantMemories)

    // Estimate emotion hint
    const emotionHint = this.estimateEmotionHint(intent, normalized)

    return {
      intent,
      context,
      relevantMemories,
      keywords,
      emotionHint
    }
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): UserIntent {
    // Greeting patterns
    if (/^(hi|hello|hey|sup|สวัสดี|หวัดดี|ว่าไง)/.test(message)) {
      return 'greeting'
    }

    // Farewell patterns
    if (/(bye|goodbye|see you|later|ไปละ|บาย|ไปก่อน)/.test(message)) {
      return 'farewell'
    }

    // Question patterns
    // Thai typically places question words at the END of a sentence
    // ("ชื่อผมคืออะไร", "เธอชื่ออะไร") so we scan anywhere — not just the
    // start. English wh-words still anchor to start to avoid false positives
    // from words like "rather" (contains "rather"/"that"/"when…" embeded).
    if (
      message.includes('?') ||
      /^(what|why|how|when|where|who)\b/i.test(message) ||
      /(อะไร|ทำไม|ยังไง|เมื่อไหร่|ที่ไหน|ใคร|หรือเปล่า|ใช่ไหม|รึเปล่า|ไหม)/.test(message)
    ) {
      return 'question'
    }

    // Praise patterns
    if (/(good|great|awesome|amazing|cool|เก่ง|เจ๋ง|เท่|ดี)/.test(message)) {
      return 'praise'
    }

    // Criticism patterns
    if (/(bad|boring|stupid|wrong|แย่|เบื่อ|โง่|ผิด)/.test(message)) {
      return 'criticism'
    }

    // Emotion expressions
    if (/(feel|felt|happy|sad|angry|scared|รู้สึก|ดีใจ|เศร้า|โกรธ|กลัว)/.test(message)) {
      return 'emotion'
    }

    // Teaching patterns (user explains something)
    if (/(is|means|คือ|หมายความว่า|แปลว่า)/.test(message)) {
      return 'teaching'
    }

    // Default: statement
    return 'statement'
  }

  /**
   * Extract keywords from message
   */
  private extractKeywords(message: string): string[] {
    const words = tokenize(message)
      .filter(w => w.length > 2)
      .map(w => w.toLowerCase())

    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did',
      'ก็', 'ที่', 'เป็น', 'มี', 'ได้', 'แล้ว'
    ])

    return words.filter(w => !stopWords.has(w))
  }

  /**
   * Find relevant memories based on keywords
   *
   * Three scoring channels (additive):
   *   1. memory.keywords ∩ query keywords — canonical mds-core 5.11 field
   *      (preferred when populated; works across TH/EN since both languages
   *      land in the same keyword set).
   *   2. content-string substring match — legacy fallback for memories
   *      without explicit keywords (most messages from handleUserMessage).
   *   3. subject match — small bonus when a query word names the subject.
   *
   * Bilingual name-question expansion: when the query contains any of
   * {name, ชื่อ, called, เรียก}, identity-tagged memories (subject =
   * 'user_name') get a strong score boost so they always surface above
   * unrelated chatter — across language boundaries.
   */
  private findRelevantMemories(entity: Entity, keywords: string[]): Memory[] {
    if (!entity.memory) return []

    const allMemories = entity.memory.recall()
    const relevant: Array<{ memory: Memory, score: number }> = []

    const NAME_QUERY_TOKENS = new Set([
      'name', 'ชื่อ', 'called', 'เรียก',
      'remember', 'recall', 'จำ',
      'who', 'ใคร',
      'know', 'รู้จัก',
    ])
    const isNameQuery = keywords.some(k => NAME_QUERY_TOKENS.has(k))

    for (const memory of allMemories) {
      let score = 0

      // 1. memory.keywords field (mds-core canonical)
      const memKeywords = (memory as any).keywords as string[] | undefined
      if (memKeywords && memKeywords.length > 0) {
        const memKwSet = new Set(memKeywords.map(k => k.toLowerCase()))
        for (const keyword of keywords) {
          if (memKwSet.has(keyword)) score += 2
        }
      }

      // 2. content substring fallback (legacy untagged memories)
      const contentStr = JSON.stringify(memory.content).toLowerCase()
      for (const keyword of keywords) {
        if (contentStr.includes(keyword)) {
          score += 1
        }
      }

      // 3. subject match bonus
      if (keywords.includes(memory.subject.toLowerCase())) {
        score += 2
      }

      // Bilingual name-question expansion: identity memories surface
      // regardless of which language the question was asked in.
      if (isNameQuery && memory.subject === 'user_name') {
        score += 5
      }

      // Weight by salience
      score *= memory.salience

      if (score > 0) {
        relevant.push({ memory, score })
      }
    }

    // Sort by score (descending) and return top 5
    return relevant
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => r.memory)
  }

  /**
   * Build context string from analysis
   */
  private buildContext(
    intent: UserIntent,
    keywords: string[],
    memories: Memory[]
  ): string {
    let context = `Intent: ${intent}\n`

    if (keywords.length > 0) {
      context += `Keywords: ${keywords.join(', ')}\n`
    }

    if (memories.length > 0) {
      context += `Relevant memories:\n`
      for (const memory of memories) {
        const contentStr = typeof memory.content === 'string'
          ? memory.content
          : JSON.stringify(memory.content)
        context += `  - ${memory.type} (${memory.subject}): ${contentStr}\n`
      }
    }

    return context
  }

  /**
   * Estimate emotion hint from intent + message
   */
  private estimateEmotionHint(intent: UserIntent, message: string): {
    valence: number
    arousal: number
  } | undefined {
    switch (intent) {
      case 'greeting':
        return { valence: 0.3, arousal: 0.4 }

      case 'praise':
        return { valence: 0.7, arousal: 0.6 }

      case 'criticism':
        return { valence: -0.5, arousal: 0.7 }

      case 'question':
        return { valence: 0.1, arousal: 0.5 }

      case 'emotion':
        // Try to detect emotion from message
        if (/(happy|good|ดี|สนุก)/.test(message)) {
          return { valence: 0.6, arousal: 0.5 }
        } else if (/(sad|bad|เศร้า|แย่)/.test(message)) {
          return { valence: -0.6, arousal: 0.3 }
        } else if (/(angry|โกรธ)/.test(message)) {
          return { valence: -0.5, arousal: 0.8 }
        }
        return { valence: 0.0, arousal: 0.5 }

      case 'farewell':
        return { valence: -0.2, arousal: 0.3 }

      default:
        return undefined
    }
  }
}
