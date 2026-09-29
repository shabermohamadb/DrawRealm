/**
 * Calculates Levenshtein distance between two strings
 * Used for detecting "close" guesses (packet $a = 16)
 */
function levenshteinDistance(a, b) {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix = [];
  for (let i = 0; i <= bl; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= al; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bl; i++) {
    for (let j = 1; j <= al; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bl][al];
}

/**
 * Returns true if candidate guess is close to secret word (1 edit difference, or 2 for long words)
 */
function isCloseGuess(guess, secret) {
  const g = guess.trim().toLowerCase();
  const s = secret.trim().toLowerCase();
  if (g === s) return false; // exact match, not just close

  const dist = levenshteinDistance(g, s);
  if (s.length <= 4) {
    return dist === 1;
  } else if (s.length <= 8) {
    return dist === 1;
  } else {
    return dist <= 2;
  }
}

module.exports = {
  levenshteinDistance,
  isCloseGuess
};
