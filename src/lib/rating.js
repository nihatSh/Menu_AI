// Ratings for the menu.
//
// The reference design shows a star rating on every dish. We collect one-tap
// thumbs after a meal, so a rating has to be derived from those rather than
// invented - and it must be honest about how little data it has.
//
// A handful of votes should not read as "4.8 stars": the score is pulled
// toward the midpoint until enough people have voted (a Bayesian prior), and
// below the threshold no rating is shown at all.

const PRIOR_VOTES = 5; // how much the neutral prior counts for
const PRIOR_SCORE = 0.75; // restaurants skew positive; this is the pull target
const MIN_VOTES = 3; // below this, show nothing rather than something fake

export function dishRating(score) {
  if (!score) return null;
  const up = score.up || 0;
  const down = score.down || 0;
  const votes = up + down;
  if (votes < MIN_VOTES) return null;

  const share = (up + PRIOR_SCORE * PRIOR_VOTES) / (votes + PRIOR_VOTES);
  // Map a 0-1 approval share onto 3.0-5.0, the range diners actually use.
  const stars = 3 + share * 2;

  return { stars: Math.round(stars * 10) / 10, votes };
}
