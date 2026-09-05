interface EarTrainerState {
  screen: string
  session: { phase: string; currentChordId: string | null } | null
}
interface Window {
  __earTrainer: { getState(): EarTrainerState }
}
