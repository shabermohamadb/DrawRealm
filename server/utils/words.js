/**
 * Word banks and selection logic for skribbl.io
 */

const WORDS_EN = [
  "apple", "banana", "orange", "pear", "strawberry", "grape", "watermelon", "pineapple",
  "cherry", "lemon", "peach", "avocado", "tomato", "potato", "carrot", "onion",
  "mushroom", "broccoli", "corn", "pizza", "burger", "sandwich", "taco", "sushi",
  "pancake", "waffle", "donut", "cookie", "cake", "ice cream", "chocolate", "popcorn",
  "dog", "cat", "mouse", "rabbit", "lion", "tiger", "bear", "elephant",
  "giraffe", "monkey", "zebra", "kangaroo", "panda", "penguin", "dolphin", "whale",
  "shark", "octopus", "turtle", "frog", "snake", "crocodile", "duck", "chicken",
  "cow", "pig", "sheep", "horse", "goat", "deer", "bee", "butterfly",
  "spider", "ant", "snail", "crab", "lobster", "eagle", "owl", "parrot",
  "car", "bus", "truck", "train", "airplane", "helicopter", "rocket", "boat",
  "ship", "submarine", "bicycle", "motorcycle", "scooter", "skateboard", "tractor", "ambulance",
  "chair", "table", "bed", "sofa", "lamp", "clock", "television", "radio",
  "computer", "laptop", "keyboard", "mousepad", "telephone", "camera", "mirror", "window",
  "door", "stairs", "key", "lock", "book", "pencil", "pen", "eraser",
  "scissors", "brush", "paint", "canvas", "guitar", "piano", "drum", "trumpet",
  "violin", "flute", "bell", "whistle", "candle", "flashlight", "battery", "umbrella",
  "sun", "moon", "star", "cloud", "rain", "rainbow", "snow", "snowflake",
  "lightning", "thunder", "fire", "water", "tree", "flower", "leaf", "grass",
  "mountain", "volcano", "river", "ocean", "beach", "island", "desert", "forest",
  "house", "castle", "bridge", "tower", "church", "hospital", "school", "tent",
  "shirt", "pants", "dress", "skirt", "jacket", "coat", "hat", "cap",
  "shoes", "boots", "socks", "gloves", "scarf", "glasses", "ring", "necklace",
  "watch", "crown", "sword", "shield", "bow", "arrow", "flag", "balloon",
  "kite", "present", "trophy", "medal", "coin", "diamond", "gold", "treasure",
  "heart", "smile", "tears", "ghost", "alien", "robot", "monster", "wizard",
  "pirate", "ninja", "superhero", "clown", "king", "queen", "baby", "doctor"
];

const WORDS_DE = [
  "Apfel", "Banane", "Orange", "Birne", "Erdbeere", "Traube", "Wassermelone", "Ananas",
  "Kirsche", "Zitrone", "Pfirsich", "Avocado", "Tomate", "Kartoffel", "Karotte", "Zwiebel",
  "Pilz", "Brokkoli", "Mais", "Pizza", "Burger", "Sandwich", "Taco", "Sushi",
  "Hund", "Katze", "Maus", "Hase", "Löwe", "Tiger", "Bär", "Elefant",
  "Giraffe", "Affe", "Zebra", "Känguru", "Panda", "Pinguin", "Delfin", "Wal",
  "Hai", "Krake", "Schildkröte", "Frosch", "Schlange", "Krokodil", "Ente", "Huhn",
  "Kuh", "Schwein", "Schaf", "Pferd", "Ziege", "Hirsch", "Biene", "Schmetterling",
  "Auto", "Bus", "Lastwagen", "Zug", "Flugzeug", "Hubschrauber", "Rakete", "Boot",
  "Schiff", "Fahrrad", "Motorrad", "Traktor", "Krankenwagen", "Sonne", "Mond", "Stern",
  "Baum", "Blume", "Berg", "Vulkan", "Fluss", "Haus", "Schloss", "Brücke"
];

const CATEGORY_WORDS = {
  Anime: [
    "goku", "naruto", "luffy", "titan", "ninja", "katana", "chakra", "saiyan",
    "pokemon", "pikachu", "dragon", "mecha", "shinigami", "alchemist", "senpai",
    "sensei", "demon", "hunter", "ghoul", "pirate", "bleach", "sharingan",
    "rasengan", "stand", "deku", "all might", "eren", "levi", "itachi", "sasuke",
    "vegeta", "zenitsu", "tanjiro", "sukuna", "gojo"
  ],
  Cars: [
    "car", "bus", "truck", "train", "airplane", "helicopter", "rocket", "boat",
    "ship", "submarine", "bicycle", "motorcycle", "scooter", "skateboard", "tractor",
    "ambulance", "engine", "wheel", "tire", "sedan", "ferrari", "porsche", "bumper",
    "steering wheel", "brake", "exhaust", "turbo", "clutch", "gearbox", "tesla",
    "roadster", "mustang", "corvette", "battery", "headlight", "windshield", "spoiler", "radiator"
  ],
  Animals: [
    "dog", "cat", "mouse", "rabbit", "lion", "tiger", "bear", "elephant",
    "giraffe", "monkey", "zebra", "kangaroo", "panda", "penguin", "dolphin", "whale",
    "shark", "octopus", "turtle", "frog", "snake", "crocodile", "duck", "chicken",
    "cow", "pig", "sheep", "horse", "goat", "deer", "bee", "butterfly",
    "spider", "ant", "snail", "crab", "lobster", "eagle", "owl", "parrot"
  ],
  Food: [
    "apple", "banana", "orange", "pear", "strawberry", "grape", "watermelon", "pineapple",
    "cherry", "lemon", "peach", "avocado", "tomato", "potato", "carrot", "onion",
    "mushroom", "broccoli", "corn", "pizza", "burger", "sandwich", "taco", "sushi",
    "pancake", "waffle", "donut", "cookie", "cake", "ice cream", "chocolate", "popcorn",
    "pasta", "ramen", "cheese"
  ],
  Gaming: [
    "controller", "joystick", "console", "arcade", "quest", "boss", "pixel",
    "dungeon", "armor", "shield", "sword", "potion", "respawn", "stealth",
    "glitch", "headset", "keyboard", "mousepad", "gamer", "level", "portal",
    "inventory", "loot", "avatar", "mana", "health bar"
  ]
};

const WORD_DICTIONARIES = {
  0: WORDS_EN, // English
  1: WORDS_DE  // German
};

/**
 * Normalizes a category string to match CATEGORY_WORDS keys
 */
function resolveCategory(cat) {
  if (!cat || typeof cat !== "string") return null;
  const clean = cat.trim().toLowerCase();
  for (const key of Object.keys(CATEGORY_WORDS)) {
    if (key.toLowerCase() === clean) return key;
  }
  return null;
}

/**
 * Returns an array of random words for the word choice phase.
 * @param {number} langId - Language index
 * @param {number} count - Number of words to pick (e.g. 3)
 * @param {Array<string>} customWords - Custom words array if provided
 * @param {boolean} customOnly - If true, only pick from customWords
 * @param {string} [category] - Optional category filter (e.g. "Anime", "Cars", "Animals", "Food", "Gaming", "Random")
 * @returns {Array<string>}
 */
function getRandomWords(langId = 0, count = 3, customWords = [], customOnly = false, category = "Random") {
  let pool = [];

  if (customOnly && customWords && customWords.length >= 3) {
    pool = [...customWords];
  } else {
    const matchedCategory = resolveCategory(category);
    let categoryList = null;
    if (matchedCategory && CATEGORY_WORDS[matchedCategory]) {
      categoryList = CATEGORY_WORDS[matchedCategory];
    }

    if (categoryList && categoryList.length > 0) {
      pool = [...categoryList];
      if (customWords && customWords.length > 0) {
        pool = [...pool, ...customWords];
      }
    } else if (customWords && customWords.length > 0) {
      const baseDict = WORD_DICTIONARIES[langId] || WORDS_EN;
      pool = [...baseDict, ...customWords];
    } else {
      pool = WORD_DICTIONARIES[langId] || WORDS_EN;
    }
  }

  // Deduplicate and filter words
  pool = Array.from(new Set(pool.map(w => w.trim()).filter(w => w.length > 0)));
  if (pool.length === 0) pool = WORDS_EN;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

module.exports = {
  WORDS_EN,
  WORDS_DE,
  CATEGORY_WORDS,
  resolveCategory,
  getRandomWords
};
