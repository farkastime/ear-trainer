import { DEFAULT_PACING_PARAMS } from '../../core/engine/pacing'
import { NAP_ACCURACY, NAP_SESSIONS, WAKE_STREAK } from '../../core/engine/nap'
import { useAppStore } from '../../state/store'
import { APP_NAME } from '../components/AppHeader'

const P = DEFAULT_PACING_PARAMS

export function About() {
  const goTo = useAppStore((s) => s.goTo)
  return (
    <div className="screen about" data-screen="about" data-testid="screen-about">
      <div className="row">
        <button className="icon-button" aria-label="Back" onClick={() => goTo('home')}>
          ←
        </button>
        <h1 className="screen-title grow">Welcome to {APP_NAME}</h1>
      </div>

      <section className="card">
        <p>
          {APP_NAME} helps young children (about three to eight) learn to recognise chords by ear.
          Every chord has a colour and an animal friend. The child hears a chord, taps the friend it
          belongs to, and the friends multiply as their ear grows.
        </p>
        <p>
          Sessions are short on purpose. A few minutes, a few times a day, beats one long sitting.
        </p>
      </section>

      <section className="card">
        <h2>The Eguchi method</h2>
        <p>
          The Chord Identification Method was developed by Japanese piano teacher Chieko Eguchi for
          children of preschool age. Instead of naming single notes, the child learns to recognise
          whole chords, each always played with the same notes and each paired with a coloured flag.
          Training starts with two chords and adds one at a time: the nine white-key chords first,
          then the black-key chords.
        </p>
        <p>The original protocol is strict:</p>
        <ul>
          <li>Several sessions a day, each only two or three minutes long.</li>
          <li>A new chord is added only once the current set is answered perfectly.</li>
          <li>About two weeks pass between one new chord and the next.</li>
        </ul>
        <p>
          Children trained this way have been followed in published research. Sakakibara (2014)
          tracked children aged two to six through the full programme and reported that those who
          completed it acquired absolute pitch, the ability to name a note without a reference.
          Miyazaki and Ogawa (2006) tested children at a music school that uses this kind of
          training and found pitch-naming accuracy rising steadily between ages four and seven, with
          white-key notes learned before black-key notes, which is why the chords are introduced in
          that order here.
        </p>
        <p className="muted small">
          Sakakibara, A. (2014). A longitudinal study of the process of acquiring absolute pitch: A
          practical report of training with the &lsquo;chord identification method&rsquo;.{' '}
          <em>Psychology of Music</em>, 42(1), 86–111.
          <br />
          Miyazaki, K., &amp; Ogawa, Y. (2006). Learning absolute pitch by children: A
          cross-sectional study. <em>Music Perception</em>, 24(1), 63–78.
          <br />
          The chord set, voicings and colours follow Paul Ganssle&rsquo;s open-source
          <em> cim</em> trainer, which documents Eguchi&rsquo;s protocol.
        </p>
      </section>

      <section className="card">
        <h2>How {APP_NAME} works</h2>
        <ul>
          <li>
            <strong>Practice.</strong> On the home screen, tap any tile to hear its chord. Use it to
            introduce a new friend before a session.
          </li>
          <li>
            <strong>Play.</strong> After a quick run-through of the friends, the app plays a chord
            and the child taps the matching tile. A right answer gets confetti; a wrong one shows
            the right tile and moves on. There are no penalties.
          </li>
          <li>
            <strong>Streaks and stars.</strong> Correct answers in a row build a streak with bigger
            celebrations at 5 and 10. Each session earns stars for accuracy.
          </li>
          <li>
            <strong>New friends.</strong> When the pacing rule below says the child is ready, the
            next chord unlocks with a fanfare, and the child meets it before play resumes.
          </li>
          <li>
            <strong>Naps.</strong> If {NAP_SESSIONS} sessions in a row finish under{' '}
            {Math.round(NAP_ACCURACY * 100)}% correct, the newest friend takes a nap (💤) and is
            left out of questions so the child can steady the others. It wakes after {WAKE_STREAK}{' '}
            correct in a row. Grown-ups can wake it early, or rewind a level to remove the newest
            chord altogether.
          </li>
          <li>
            <strong>Overtime.</strong> In Unlimited pacing, a session that ends on a correct answer
            keeps going while the streak lasts, so a child on a roll can reach the unlock.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Pacing modes</h2>
        <p>Grown-ups choose how new chords unlock, in the settings behind the gear.</p>
        <ul>
          <li>
            <strong>Unlimited</strong> (default). A new chord unlocks as soon as the child answers{' '}
            {P.streakTarget} in a row correctly within a session. The number is adjustable. Fastest,
            and good for a child who is clearly finding it easy.
          </li>
          <li>
            <strong>Eguchi.</strong> Follows the original protocol. A new chord unlocks only when
            the last {P.eguchiWindow} answers were all correct, at least {P.eguchiDays} days have
            passed since the last new chord, and at least {P.eguchiSessions} sessions have been
            completed since then. A session counts once at least half its questions are answered.
            Slow and steady, the way the method was studied.
          </li>
          <li>
            <strong>Manual.</strong> Nothing unlocks on its own. The home screen shows a
            &ldquo;ready&rdquo; badge when the Unlimited rule would have fired, and the grown-up
            unlocks the next chord from settings.
          </li>
        </ul>
        <p>
          Switching modes is safe at any time. Each rule is judged from the child&rsquo;s history,
          not from the mode that was active before.
        </p>
      </section>

      <section className="card">
        <h2>Tips</h2>
        <ul>
          <li>Keep it playful. Stop while it is still fun.</li>
          <li>Use a quiet room and a decent speaker or headphones.</li>
          <li>Let the child tap the tiles freely between sessions.</li>
          <li>
            Progress is saved on this device. Export a profile from settings to keep a backup or
            move it to another device.
          </li>
        </ul>
      </section>

      <button className="big-button" onClick={() => goTo('home')}>
        Back to play
      </button>
    </div>
  )
}
