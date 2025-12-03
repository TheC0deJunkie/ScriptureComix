import { GuidedJourney, UserTier } from "../types";

export const GUIDED_JOURNEYS: GuidedJourney[] = [
  {
    id: "genesis-origin",
    title: "Origins & Promises",
    description: "Walk through the foundational covenants from Creation to Abraham and watch redemption themes develop.",
    badge: "GENESIS SCOUT",
    duration: "5 chapters",
    recommendedTier: UserTier.FREE,
    chapters: [
      { book: "Genesis", chapter: 1, focus: "Creation + Imago Dei", xpReward: 120 },
      { book: "Genesis", chapter: 3, focus: "The Fall & Hope", xpReward: 120 },
      { book: "Genesis", chapter: 12, focus: "Abram's Call", xpReward: 150 },
      { book: "Genesis", chapter: 22, focus: "Trust on Moriah", xpReward: 180 },
      { book: "Genesis", chapter: 28, focus: "Jacob's Ladder", xpReward: 150 }
    ]
  },
  {
    id: "gospel-miracles",
    title: "Miracles with Jesus",
    description: "Experience a highlight reel of compassion, power, and kingdom imagination across the Gospels.",
    badge: "GALILEE GUIDE",
    duration: "6 chapters",
    recommendedTier: UserTier.EXPLORER,
    chapters: [
      { book: "Mark", chapter: 2, focus: "Faithful Friends", xpReward: 140 },
      { book: "Luke", chapter: 7, focus: "Compassion for outsiders", xpReward: 140 },
      { book: "Matthew", chapter: 14, focus: "Water Walker", xpReward: 160 },
      { book: "John", chapter: 11, focus: "Resurrection preview", xpReward: 200 },
      { book: "Luke", chapter: 15, focus: "Prodigal embrace", xpReward: 160 },
      { book: "John", chapter: 20, focus: "Empty tomb hope", xpReward: 220 }
    ]
  },
  {
    id: "wisdom-justice",
    title: "Wisdom & Justice",
    description: "Pair wisdom literature with prophetic justice calls to form a holistic discipleship rhythm.",
    badge: "PROPHETIC VOICE",
    duration: "4 chapters",
    recommendedTier: UserTier.SCHOLAR,
    chapters: [
      { book: "Proverbs", chapter: 3, focus: "Trusting Wisdom", xpReward: 130 },
      { book: "Isaiah", chapter: 58, focus: "True fasting", xpReward: 180 },
      { book: "Amos", chapter: 5, focus: "Let justice roll", xpReward: 200 },
      { book: "James", chapter: 2, focus: "Faith in action", xpReward: 160 }
    ]
  },
  {
    id: "exodus-escape",
    title: "Exodus: Escape & Promise",
    description: "Walk with Moses from Egypt to the wilderness, focusing on courage, leadership, and God's provision.",
    badge: "Liberator",
    duration: "5 chapters",
    recommendedTier: UserTier.EXPLORER,
    chapters: [
      { book: "Exodus", chapter: 1, focus: "Hebrew resilience", xpReward: 80 },
      { book: "Exodus", chapter: 3, focus: "Burning bush calling", xpReward: 90 },
      { book: "Exodus", chapter: 7, focus: "Confronting Pharaoh", xpReward: 100 },
      { book: "Exodus", chapter: 12, focus: "Passover night", xpReward: 100 },
      { book: "Exodus", chapter: 14, focus: "Red Sea faith", xpReward: 120 },
    ],
  },
  {
    id: "kingdom-king",
    title: "Shepherd to King",
    description: "A rise-of-David arc that highlights courage, worship, and integrity under pressure.",
    badge: "Kingdom Builder",
    duration: "4 chapters",
    recommendedTier: UserTier.FREE,
    chapters: [
      { book: "1 Samuel", chapter: 16, focus: "Anointing & humility", xpReward: 60 },
      { book: "1 Samuel", chapter: 17, focus: "Goliath showdown", xpReward: 100 },
      { book: "1 Samuel", chapter: 24, focus: "Mercy in the cave", xpReward: 80 },
      { book: "2 Samuel", chapter: 7, focus: "Covenant promise", xpReward: 90 },
    ],
  },
  {
    id: "gospel-journey",
    title: "Meals with Jesus",
    description: "Follow Jesus through iconic meals that transformed people—ideal for Scholar tier's deep dives.",
    badge: "Table Companion",
    duration: "6 chapters",
    recommendedTier: UserTier.SCHOLAR,
    chapters: [
      { book: "Luke", chapter: 5, focus: "Calling Levi", xpReward: 70 },
      { book: "Luke", chapter: 7, focus: "Forgiveness & worship", xpReward: 90 },
      { book: "Luke", chapter: 9, focus: "Feeding the 5,000", xpReward: 110 },
      { book: "Luke", chapter: 14, focus: "Kingdom hospitality", xpReward: 85 },
      { book: "Luke", chapter: 22, focus: "Passover to communion", xpReward: 120 },
      { book: "Luke", chapter: 24, focus: "Emmaus revelation", xpReward: 140 },
    ],
  }
];

