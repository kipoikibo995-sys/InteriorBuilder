// Puzzle generators: Sudoku and Word Search.
// Everything is driven by a seeded RNG, so puzzle #n is identical in the preview and in the PDF.
(function (global) {
  'use strict';

  // ---------- Seeded random ----------

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Sudoku ----------

  // Cells are a flat array of 81 numbers, 0 = empty.
  const PEERS = (() => {
    const peers = [];
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9, br = r - (r % 3), bc = c - (c % 3);
      const set = new Set();
      for (let k = 0; k < 9; k++) {
        set.add(r * 9 + k);
        set.add(k * 9 + c);
        set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3));
      }
      set.delete(i);
      peers.push([...set]);
    }
    return peers;
  })();

  function candidates(grid, i) {
    let mask = 0x3fe; // bits 1..9
    for (const p of PEERS[i]) mask &= ~(1 << grid[p]);
    return mask;
  }

  function bitCount(m) {
    let n = 0;
    while (m) {
      m &= m - 1;
      n++;
    }
    return n;
  }

  // Counts solutions up to `limit`, filling `grid` in place with the first one found when fill = true.
  function solve(grid, limit, rand, fill) {
    let count = 0;
    const g = grid.slice();
    function rec() {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = candidates(g, i);
        const n = bitCount(m);
        if (n === 0) return false;
        if (n < bestN) {
          best = i; bestMask = m; bestN = n;
          if (n === 1) break;
        }
      }
      if (best === -1) {
        count++;
        if (fill && count === 1) for (let i = 0; i < 81; i++) grid[i] = g[i];
        return count >= limit;
      }
      const digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
      if (rand) shuffle(digits, rand);
      for (const d of digits) {
        g[best] = d;
        if (rec()) return true;
      }
      g[best] = 0;
      return false;
    }
    rec();
    return count;
  }

  const SUDOKU_LEVELS = {
    easy: { label: 'Easy', clues: 40 },
    medium: { label: 'Medium', clues: 32 },
    hard: { label: 'Hard', clues: 27 },
    expert: { label: 'Expert', clues: 23 },
  };

  // Returns { puzzle, solution, clues, level } with a unique solution.
  function sudoku(seed, level) {
    const rand = rng(seed);
    const solution = new Array(81).fill(0);
    solve(solution, 1, rand, true);
    const puzzle = solution.slice();
    const target = (SUDOKU_LEVELS[level] || SUDOKU_LEVELS.medium).clues;
    let clues = 81;
    // Remove cells in symmetric pairs while the solution stays unique.
    const order = shuffle([...Array(41).keys()], rand);
    for (const i of order) {
      if (clues <= target) break;
      const j = 80 - i;
      const a = puzzle[i], b = puzzle[j];
      puzzle[i] = 0;
      puzzle[j] = 0;
      if (solve(puzzle, 2, null, false) === 1) {
        clues -= i === j ? 1 : 2;
      } else {
        puzzle[i] = a;
        puzzle[j] = b;
      }
    }
    // Then single cells, which lets harder levels go below what symmetric removal reaches.
    for (const i of shuffle([...Array(81).keys()], rand)) {
      if (clues <= target) break;
      if (!puzzle[i]) continue;
      const a = puzzle[i];
      puzzle[i] = 0;
      if (solve(puzzle, 2, null, false) === 1) clues--;
      else puzzle[i] = a;
    }
    return { puzzle, solution, clues, level };
  }

  // ---------- Word Search ----------

  const DIRS = {
    easy: [[0, 1], [1, 0]],
    medium: [[0, 1], [1, 0], [1, 1], [-1, 1]],
    hard: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
  };

  const WS_LEVELS = {
    easy: 'Easy — across and down',
    medium: 'Medium — adds diagonals',
    hard: 'Hard — all 8 directions, including backwards',
  };

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function cleanWord(w) {
    return String(w).toUpperCase().replace(/[^A-Z]/g, '');
  }

  // Parses "Theme: word, word, ..." lines into [{ theme, words }].
  function parseWordLists(text) {
    return String(text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const m = line.match(/^([^:]+):(.*)$/);
        const theme = m ? m[1].trim() : `Puzzle ${i + 1}`;
        const words = (m ? m[2] : line).split(',').map((w) => w.trim()).filter((w) => cleanWord(w).length >= 2);
        return { theme, words };
      })
      .filter((l) => l.words.length);
  }

  // Returns { size, grid: [[char]], placed: [{word, r, c, dr, dc, len}], theme }.
  function wordSearch(seed, opts) {
    const rand = rng(seed);
    const size = opts.size;
    const dirs = DIRS[opts.level] || DIRS.medium;
    const pool = shuffle(opts.words.slice(), rand)
      .filter((w) => cleanWord(w).length <= size);
    const want = Math.min(opts.count, pool.length);

    let best = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const grid = Array.from({ length: size }, () => new Array(size).fill(''));
      const placed = [];
      const words = pool.slice().sort((a, b) => cleanWord(b).length - cleanWord(a).length);
      for (const word of words) {
        if (placed.length >= want) break;
        const w = cleanWord(word);
        let done = false;
        for (let tries = 0; tries < 200 && !done; tries++) {
          const [dr, dc] = dirs[Math.floor(rand() * dirs.length)];
          const r = Math.floor(rand() * size), c = Math.floor(rand() * size);
          const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
          let ok = true;
          for (let k = 0; k < w.length && ok; k++) {
            const ch = grid[r + dr * k][c + dc * k];
            if (ch && ch !== w[k]) ok = false;
          }
          if (!ok) continue;
          for (let k = 0; k < w.length; k++) grid[r + dr * k][c + dc * k] = w[k];
          placed.push({ word, r, c, dr, dc, len: w.length });
          done = true;
        }
      }
      if (!best || placed.length > best.placed.length) best = { grid, placed };
      if (placed.length >= want) break;
    }
    for (const row of best.grid)
      for (let c = 0; c < size; c++) if (!row[c]) row[c] = ALPHABET[Math.floor(rand() * 26)];
    best.placed.sort((a, b) => cleanWord(a.word).localeCompare(cleanWord(b.word)));
    return { size, grid: best.grid, placed: best.placed, theme: opts.theme };
  }

  // ---------- Built-in word lists ----------

  const WORD_BANK = `Animals: Elephant, Giraffe, Kangaroo, Zebra, Monkey, Tiger, Lion, Panda, Koala, Rabbit, Squirrel, Hedgehog, Penguin, Dolphin, Camel, Cheetah, Gorilla, Leopard, Rhino, Hippo, Otter, Beaver, Moose, Wolf
Fruits: Apple, Banana, Cherry, Grape, Mango, Orange, Peach, Pear, Plum, Kiwi, Lemon, Lime, Papaya, Coconut, Apricot, Melon, Guava, Fig, Raspberry, Blueberry, Strawberry, Pineapple, Pomegranate, Tangerine
Ocean: Wave, Coral, Shark, Whale, Octopus, Seaweed, Starfish, Jellyfish, Crab, Lobster, Shrimp, Oyster, Clam, Tide, Reef, Lagoon, Dolphin, Seahorse, Current, Harbor, Sailor, Anchor, Island, Pearl
Space: Planet, Galaxy, Comet, Meteor, Asteroid, Orbit, Rocket, Saturn, Jupiter, Mars, Venus, Mercury, Neptune, Uranus, Nebula, Eclipse, Telescope, Astronaut, Satellite, Gravity, Cosmos, Lunar, Solar, Stardust
Sports: Soccer, Tennis, Hockey, Golf, Baseball, Basketball, Volleyball, Rugby, Cricket, Boxing, Cycling, Skiing, Surfing, Archery, Bowling, Karate, Fencing, Rowing, Sailing, Diving, Sprint, Marathon, Referee, Trophy
Kitchen: Spoon, Fork, Knife, Plate, Bowl, Kettle, Oven, Stove, Toaster, Blender, Whisk, Ladle, Spatula, Skillet, Grater, Colander, Teapot, Mixer, Napkin, Apron, Cupboard, Pantry, Freezer, Rolling Pin
Weather: Sunny, Cloudy, Rain, Snow, Storm, Thunder, Lightning, Breeze, Fog, Mist, Hail, Sleet, Rainbow, Tornado, Hurricane, Drizzle, Frost, Humid, Forecast, Climate, Blizzard, Monsoon, Drought, Heatwave
Jobs: Doctor, Nurse, Teacher, Farmer, Pilot, Chef, Baker, Dentist, Lawyer, Engineer, Artist, Writer, Plumber, Painter, Firefighter, Police, Mechanic, Pharmacist, Architect, Scientist, Librarian, Carpenter, Tailor, Florist
Garden: Flower, Rose, Tulip, Daisy, Lily, Orchid, Sunflower, Seed, Soil, Shovel, Rake, Hose, Fence, Weed, Compost, Bloom, Petal, Stem, Root, Leaf, Shrub, Hedge, Greenhouse, Butterfly
Music: Piano, Guitar, Violin, Drums, Flute, Trumpet, Cello, Harp, Melody, Rhythm, Tempo, Chord, Note, Concert, Choir, Opera, Jazz, Blues, Rock, Symphony, Orchestra, Lyrics, Chorus, Saxophone
Travel: Passport, Luggage, Ticket, Airport, Hotel, Beach, Mountain, Museum, Map, Compass, Cruise, Train, Journey, Tourist, Souvenir, Camera, Backpack, Adventure, Vacation, Resort, Island, Border, Visa, Flight
Colors: Red, Blue, Green, Yellow, Purple, Orange, Pink, Brown, Black, White, Silver, Gold, Violet, Indigo, Turquoise, Magenta, Crimson, Scarlet, Maroon, Beige, Lavender, Olive, Coral, Navy
Christmas: Santa, Reindeer, Sleigh, Snowman, Present, Stocking, Ornament, Candy Cane, Tinsel, Wreath, Holly, Mistletoe, Carol, Angel, Star, Bells, Elf, Gingerbread, Chimney, Cookies, Ribbon, Snowflake, Lights, Eggnog
Halloween: Pumpkin, Ghost, Witch, Broom, Candy, Costume, Spider, Bat, Skeleton, Zombie, Vampire, Haunted, Lantern, Cauldron, Potion, Spooky, Moon, Owl, Mummy, Monster, Treat, Trick, Cobweb, Graveyard
Dinosaurs: Raptor, Fossil, Jurassic, Triassic, Stegosaurus, Triceratops, Pterodactyl, Brontosaurus, Tyrannosaurus, Herbivore, Carnivore, Extinct, Volcano, Skeleton, Claw, Tail, Egg, Spike, Horn, Swamp, Fern, Roar, Giant, Prehistoric
Food: Pizza, Pasta, Burger, Sandwich, Salad, Soup, Noodles, Rice, Bread, Cheese, Butter, Pancake, Waffle, Omelet, Taco, Burrito, Sushi, Steak, Chicken, Bacon, Cookie, Muffin, Donut, Popcorn
Birds: Eagle, Hawk, Falcon, Owl, Parrot, Robin, Sparrow, Crow, Raven, Pigeon, Swan, Goose, Duck, Flamingo, Peacock, Pelican, Stork, Heron, Hummingbird, Woodpecker, Canary, Finch, Ostrich, Toucan
Body: Head, Shoulder, Knee, Elbow, Wrist, Ankle, Finger, Thumb, Heart, Lungs, Brain, Liver, Stomach, Muscle, Bone, Skin, Spine, Ribs, Skull, Eyebrow, Eyelash, Tongue, Teeth, Chin
Bible: Genesis, Exodus, Psalms, Proverbs, Gospel, Moses, Abraham, David, Noah, Jonah, Esther, Ruth, Daniel, Peter, Paul, Mary, Joseph, Faith, Hope, Grace, Prayer, Heaven, Angel, Blessing
Camping: Tent, Campfire, Lantern, Sleeping Bag, Hiking, Trail, Forest, River, Lake, Canoe, Fishing, Marshmallow, Compass, Flashlight, Backpack, Cabin, Firewood, Map, Binoculars, Wildlife, Stars, Cooler, Hammock, Blanket`;

  global.Puzzles = {
    rng, hash, shuffle, sudoku, solve, SUDOKU_LEVELS,
    wordSearch, parseWordLists, cleanWord, WS_LEVELS, WORD_BANK,
  };
})(typeof window !== 'undefined' ? window : globalThis);
