type SoundName =
  | 'join'
  | 'playerJoin'
  | 'gameStart'
  | 'countdownTick'
  | 'showcaseWhoosh'
  | 'voteLike'
  | 'voteNope'
  | 'resultsReveal'
  | 'match'
  | 'submit'

const SOUND_FILES: Record<SoundName, string> = {
  join: '/sounds/join.mp3',
  playerJoin: '/sounds/player-join.mp3',
  gameStart: '/sounds/game-start.mp3',
  countdownTick: '/sounds/countdown-tick.mp3',
  showcaseWhoosh: '/sounds/showcase-whoosh.mp3',
  voteLike: '/sounds/vote-like.mp3',
  voteNope: '/sounds/vote-nope.mp3',
  resultsReveal: '/sounds/results-reveal.mp3',
  match: '/sounds/match.mp3',
  submit: '/sounds/submit.mp3',
}

const MUTE_KEY = 'catfished-sfx-muted'

class SFXManager {
  private cache: Map<string, HTMLAudioElement> = new Map()
  private _muted: boolean = false
  private _initialized: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this._muted = localStorage.getItem(MUTE_KEY) === 'true'
      this._initialized = true
    }
  }

  get muted(): boolean {
    return this._muted
  }

  toggle(): boolean {
    this._muted = !this._muted
    if (typeof window !== 'undefined') {
      localStorage.setItem(MUTE_KEY, String(this._muted))
    }
    return this._muted
  }

  preload(...names: SoundName[]) {
    if (typeof window === 'undefined') return
    for (const name of names) {
      const src = SOUND_FILES[name]
      if (!src || this.cache.has(src)) continue
      const audio = new Audio(src)
      audio.preload = 'auto'
      this.cache.set(src, audio)
    }
  }

  preloadAll() {
    this.preload(...(Object.keys(SOUND_FILES) as SoundName[]))
  }

  play(name: SoundName) {
    if (typeof window === 'undefined' || this._muted) return
    const src = SOUND_FILES[name]
    if (!src) return

    // Clone from cache or create new
    const cached = this.cache.get(src)
    if (cached) {
      const clone = cached.cloneNode() as HTMLAudioElement
      clone.volume = 0.6
      clone.play().catch(() => {})
    } else {
      const audio = new Audio(src)
      audio.volume = 0.6
      audio.play().catch(() => {})
      this.cache.set(src, audio)
    }
  }
}

export const sfx = new SFXManager()
export type { SoundName }
