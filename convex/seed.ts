import { mutation, query } from "./_generated/server";

// Default categories for the retirement planner
const DEFAULT_CATEGORIES = [
  // Income
  { name: "Salary", type: "income" as const, isEssential: true, color: "#4CAF50", sortOrder: 1 },
  { name: "Investment Income", type: "income" as const, isEssential: true, color: "#8BC34A", sortOrder: 2 },
  { name: "Other Income", type: "income" as const, isEssential: false, color: "#CDDC39", sortOrder: 3 },

  // Essential Expenses
  { name: "Housing", type: "expense" as const, isEssential: true, color: "#2196F3", sortOrder: 10 },
  { name: "Utilities", type: "expense" as const, isEssential: true, color: "#03A9F4", sortOrder: 11 },
  { name: "Groceries", type: "expense" as const, isEssential: true, color: "#00BCD4", sortOrder: 12 },
  { name: "Healthcare", type: "expense" as const, isEssential: true, color: "#009688", sortOrder: 13 },
  { name: "Insurance", type: "expense" as const, isEssential: true, color: "#4DB6AC", sortOrder: 14 },
  { name: "Transportation", type: "expense" as const, isEssential: true, color: "#FF9800", sortOrder: 15 },

  // Discretionary Expenses
  { name: "Dining Out", type: "expense" as const, isEssential: false, color: "#FF5722", sortOrder: 20 },
  { name: "Entertainment", type: "expense" as const, isEssential: false, color: "#E91E63", sortOrder: 21 },
  { name: "Shopping", type: "expense" as const, isEssential: false, color: "#9C27B0", sortOrder: 22 },
  { name: "Travel", type: "expense" as const, isEssential: false, color: "#673AB7", sortOrder: 23 },
  { name: "Subscriptions", type: "expense" as const, isEssential: false, color: "#3F51B5", sortOrder: 24 },
  { name: "Personal Care", type: "expense" as const, isEssential: false, color: "#7C4DFF", sortOrder: 25 },
  { name: "Gifts", type: "expense" as const, isEssential: false, color: "#F44336", sortOrder: 26 },
  { name: "Life Expense", type: "expense" as const, isEssential: false, color: "#78909C", sortOrder: 27 },
  { name: "Gas", type: "expense" as const, isEssential: true, color: "#FFC107", sortOrder: 16 },

  // Other
  { name: "Transfers", type: "transfer" as const, isEssential: false, color: "#9E9E9E", sortOrder: 90 },
  { name: "Uncategorized", type: "expense" as const, isEssential: false, color: "#607D8B", sortOrder: 99 },
];

// Default categorization rules
const DEFAULT_RULES = [
  // Income patterns
  { pattern: "PAYROLL|DIRECT DEP|SALARY", categoryName: "Salary", priority: 100 },
  { pattern: "DIVIDEND|DIV\\s+|INTEREST", categoryName: "Investment Income", priority: 100 },

  // Essential expenses
  { pattern: "MORTGAGE|HOME LOAN|RENT\\s+PAYMENT", categoryName: "Housing", priority: 90 },
  { pattern: "ELECTRIC|GAS\\s+CO|WATER\\s+UTIL|UTILITY|CONSUMERS ENERGY|GLSWA", categoryName: "Utilities", priority: 90 },
  { pattern: "KROGER|SAFEWAY|WHOLE\\s*FOODS|TRADER\\s*JOE|PUBLIX|WEGMANS|ALDI|MEIJER STORE", categoryName: "Groceries", priority: 85 },
  { pattern: "PHARMACY|CVS|WALGREENS|RITE\\s*AID|MEDICATION|BRONSON|HEALTH|MEDICAL", categoryName: "Healthcare", priority: 85 },
  { pattern: "INSURANCE|GEICO|STATE\\s*FARM|ALLSTATE|PROGRESSIVE|HANOVER|LIBERTY MUTUAL", categoryName: "Insurance", priority: 85 },

  // Gas stations
  { pattern: "SHELL|EXXON|CHEVRON|BP|MOBIL|GAS\\s*STATION|FUEL|MEIJER EXPRESS|SPEEDWAY", categoryName: "Gas", priority: 80 },

  // Transportation (non-gas)
  { pattern: "UBER|LYFT|TAXI|PARKING|TOLL", categoryName: "Transportation", priority: 80 },

  // Discretionary
  { pattern: "RESTAURANT|DOORDASH|GRUBHUB|UBER\\s*EATS|MCDONALD|STARBUCKS|CHIPOTLE|DINING|RED ROBIN|JETS PIZZA|CONEY ISLAND|BAKERY|CAFE|BAR|GRILL|BREWING", categoryName: "Dining Out", priority: 75 },
  { pattern: "NETFLIX|HULU|SPOTIFY|DISNEY\\+|HBO|AMAZON\\s*PRIME|YOUTUBE|PELOTON|PERPLEXITY", categoryName: "Subscriptions", priority: 75 },
  { pattern: "AMAZON|AMZN|WALMART|TARGET|COSTCO|BEST\\s*BUY|BARNES|WILLIAMS-SONOMA|BOUTIQUE|TOY", categoryName: "Shopping", priority: 70 },
  { pattern: "MOVIE|CINEMA|THEATER|CONCERT|TICKET|CELEBRATION CINEMA|TICKETMASTER", categoryName: "Entertainment", priority: 70 },
  { pattern: "AIRLINE|HOTEL|AIRBNB|BOOKING\\.COM|EXPEDIA", categoryName: "Travel", priority: 70 },

  // Transfers (should not count in spending)
  { pattern: "TRANSFER|XFER|VENMO|ZELLE|PAYPAL|AUTOPAY PYMT|CRCARDPMT|PAYMENT/CREDIT", categoryName: "Transfers", priority: 60 },
];

// Expanded rules - additional patterns to catch more transactions
const EXPANDED_RULES = [
  // Additional Income patterns
  { pattern: "PENSION|SOCIAL\\s*SECURITY|SSA|RETIREMENT", categoryName: "Other Income", priority: 100 },
  { pattern: "REFUND|REBATE|CASHBACK|REWARD", categoryName: "Other Income", priority: 70 },

  // Additional Housing
  { pattern: "HOA|PROPERTY\\s*TAX|HOME\\s*REPAIR|PLUMBER|ELECTRICIAN|HVAC|ROOFING", categoryName: "Housing", priority: 85 },

  // Additional Utilities
  { pattern: "INTERNET|COMCAST|XFINITY|ATT|VERIZON|T-MOBILE|SPECTRUM|CABLE|PHONE\\s*BILL", categoryName: "Utilities", priority: 88 },
  { pattern: "TRASH|WASTE|SEWER|DTE|REPUBLIC\\s*SERVICES", categoryName: "Utilities", priority: 88 },

  // Additional Groceries - broader patterns
  { pattern: "GROCERY|MARKET|FOOD\\s*LION|GIANT|STOP\\s*&\\s*SHOP|HARRIS\\s*TEETER", categoryName: "Groceries", priority: 83 },
  { pattern: "SPROUTS|FRESH\\s*MARKET|NATURAL\\s*GROCER|EARTH\\s*FARE", categoryName: "Groceries", priority: 83 },
  { pattern: "SAM'?S\\s*CLUB\\s*(?!GAS)|BJ'?S\\s*WHOLESALE", categoryName: "Groceries", priority: 82 },

  // Additional Healthcare
  { pattern: "DOCTOR|DENTIST|OPTOMETRIST|HOSPITAL|CLINIC|URGENT\\s*CARE|LAB\\s*CORP|QUEST\\s*DIAG", categoryName: "Healthcare", priority: 84 },
  { pattern: "THERAPY|COUNSELING|MENTAL\\s*HEALTH|PSYCHIATR", categoryName: "Healthcare", priority: 84 },

  // Additional Gas stations
  { pattern: "MARATHON|SUNOCO|CIRCLE\\s*K|WAWA|SHEETZ|QUIKTRIP|RACETRAC|CASEY", categoryName: "Gas", priority: 79 },
  { pattern: "SAM'?S\\s*CLUB\\s*GAS|COSTCO\\s*GAS|BJ'?S\\s*GAS", categoryName: "Gas", priority: 81 },

  // Additional Transportation
  { pattern: "DMV|VEHICLE\\s*REG|LICENSE|AUTO\\s*REPAIR|MECHANIC|JIFFY\\s*LUBE|VALVOLINE|TIRE", categoryName: "Transportation", priority: 78 },
  { pattern: "CARWASH|CAR\\s*WASH|DETAILING", categoryName: "Transportation", priority: 75 },

  // Additional Dining - more restaurants and food delivery
  { pattern: "PIZZA|TACO|BURGER|WENDY|ARBY|SONIC|CHICK-?FIL-?A|POPEYE|KFC|PANERA", categoryName: "Dining Out", priority: 74 },
  { pattern: "DUNKIN|TIM\\s*HORTON|PEET|DUTCH\\s*BROS|COFFEE", categoryName: "Dining Out", priority: 73 },
  { pattern: "DINER|TAVERN|PUB|BISTRO|EATERY|KITCHEN|CANTINA|TRATTORIA", categoryName: "Dining Out", priority: 72 },
  { pattern: "INSTACART|POSTMATES|SEAMLESS|CAVIAR|WAITR", categoryName: "Dining Out", priority: 74 },
  { pattern: "BUFFET|SUSHI|THAI|CHINESE|MEXICAN|ITALIAN|INDIAN|VIETNAMESE|KOREAN", categoryName: "Dining Out", priority: 71 },

  // Additional Subscriptions
  { pattern: "APPLE\\s*(MUSIC|TV|ONE|ICLOUD)|GOOGLE\\s*(ONE|PLAY|STORAGE)", categoryName: "Subscriptions", priority: 74 },
  { pattern: "DROPBOX|EVERNOTE|NOTION|SLACK|ZOOM|MICROSOFT\\s*365|ADOBE", categoryName: "Subscriptions", priority: 74 },
  { pattern: "GYM|FITNESS|PLANET\\s*FITNESS|LA\\s*FITNESS|YMCA|ANYTIME\\s*FITNESS", categoryName: "Subscriptions", priority: 73 },
  { pattern: "PARAMOUNT|PEACOCK|DISCOVERY|TUBI|CRUNCHYROLL|AUDIBLE", categoryName: "Subscriptions", priority: 74 },
  { pattern: "XBOX|PLAYSTATION|NINTENDO|STEAM|EPIC\\s*GAMES", categoryName: "Subscriptions", priority: 72 },

  // Additional Shopping - more retailers
  { pattern: "HOME\\s*DEPOT|LOWE'?S|MENARDS|ACE\\s*HARDWARE|TRUE\\s*VALUE", categoryName: "Shopping", priority: 69 },
  { pattern: "IKEA|WAYFAIR|OVERSTOCK|BED\\s*BATH|POTTERY\\s*BARN|CRATE\\s*&\\s*BARREL", categoryName: "Shopping", priority: 69 },
  { pattern: "NORDSTROM|MACY|JC\\s*PENNEY|KOHL|DILLARD|BELK|BLOOMINGDALE", categoryName: "Shopping", priority: 68 },
  { pattern: "OLD\\s*NAVY|GAP|BANANA\\s*REPUBLIC|H&M|ZARA|UNIQLO|FOREVER\\s*21", categoryName: "Shopping", priority: 67 },
  { pattern: "NIKE|ADIDAS|UNDER\\s*ARMOUR|FOOTLOCKER|DICK'?S\\s*SPORTING", categoryName: "Shopping", priority: 68 },
  { pattern: "STAPLES|OFFICE\\s*DEPOT|OFFICE\\s*MAX", categoryName: "Shopping", priority: 68 },
  { pattern: "ETSY|EBAY|POSHMARK|MERCARI|FACEBOOK\\s*MARKET", categoryName: "Shopping", priority: 66 },
  { pattern: "DOLLAR\\s*GENERAL|DOLLAR\\s*TREE|FIVE\\s*BELOW|BIG\\s*LOTS", categoryName: "Shopping", priority: 67 },
  { pattern: "PETCO|PETSMART|CHEWY|PET\\s*SUPPLIES", categoryName: "Shopping", priority: 68 },

  // Additional Entertainment
  { pattern: "SPOTIFY|PANDORA|SIRIUS|APPLE\\s*MUSIC", categoryName: "Entertainment", priority: 72 },
  { pattern: "BOWLING|GOLF|MINI\\s*GOLF|ARCADE|LASER\\s*TAG|ESCAPE\\s*ROOM", categoryName: "Entertainment", priority: 69 },
  { pattern: "MUSEUM|ZOO|AQUARIUM|THEME\\s*PARK|AMUSEMENT|SIX\\s*FLAGS|DISNEY\\s*PARK", categoryName: "Entertainment", priority: 69 },
  { pattern: "SPORTING\\s*EVENT|STADIUM|ARENA|BALLPARK", categoryName: "Entertainment", priority: 69 },
  { pattern: "STUB\\s*HUB|SEAT\\s*GEEK|VIVID\\s*SEATS|AXS|EVENTBRITE", categoryName: "Entertainment", priority: 69 },

  // Additional Travel
  { pattern: "DELTA|UNITED|AMERICAN\\s*AIR|SOUTHWEST|JETBLUE|SPIRIT|FRONTIER|ALASKA\\s*AIR", categoryName: "Travel", priority: 69 },
  { pattern: "MARRIOTT|HILTON|HYATT|IHG|WYNDHAM|BEST\\s*WESTERN|HOLIDAY\\s*INN|HAMPTON", categoryName: "Travel", priority: 69 },
  { pattern: "HERTZ|ENTERPRISE|NATIONAL|AVIS|BUDGET|TURO|SIXT", categoryName: "Travel", priority: 68 },
  { pattern: "VRBO|HOMEAWAY|VACASA|GETAWAY|TRIPADVISOR|KAYAK|HOPPER", categoryName: "Travel", priority: 68 },
  { pattern: "TSA|GLOBAL\\s*ENTRY|CLEAR|AIRPORT", categoryName: "Travel", priority: 67 },
  { pattern: "CRUISE|CARNIVAL|ROYAL\\s*CARIBBEAN|NORWEGIAN", categoryName: "Travel", priority: 68 },

  // Personal Care
  { pattern: "SALON|BARBER|HAIRCUT|SPA|MASSAGE|NAIL|BEAUTY|ULTA|SEPHORA", categoryName: "Personal Care", priority: 70 },
  { pattern: "DRY\\s*CLEAN|LAUNDRY|ALTERATIONS|TAILOR", categoryName: "Personal Care", priority: 68 },

  // Gifts
  { pattern: "GIFT\\s*CARD|HALLMARK|CARD\\s*SHOP|FLORIST|FLOWER|1-?800-?FLOWER|FTD", categoryName: "Gifts", priority: 65 },
  { pattern: "CHARITY|DONATION|NONPROFIT|GIVING|GOFUNDME|UNITED\\s*WAY", categoryName: "Gifts", priority: 64 },

  // Additional Transfers - catch more transfer patterns
  { pattern: "BILL\\s*PAY|BILLPAY|ONLINE\\s*PMT|ACH\\s*(DEBIT|CREDIT|PAYMENT)", categoryName: "Transfers", priority: 59 },
  { pattern: "WIRE\\s*TRANSFER|WESTERN\\s*UNION|MONEYGRAM", categoryName: "Transfers", priority: 59 },
  { pattern: "LOAN\\s*PAYMENT|STUDENT\\s*LOAN|AUTO\\s*LOAN|PERSONAL\\s*LOAN", categoryName: "Transfers", priority: 58 },
  { pattern: "CREDIT\\s*CARD\\s*(PAYMENT|PMT)|CARD\\s*SERVICES", categoryName: "Transfers", priority: 58 },
  { pattern: "IRA|401K|ROTH|BROKERAGE|FIDELITY|VANGUARD|SCHWAB|ETRADE|ROBINHOOD", categoryName: "Transfers", priority: 57 },
  { pattern: "SAVINGS\\s*TRANSFER|CHECKING\\s*TRANSFER|INTERNAL\\s*TRANSFER", categoryName: "Transfers", priority: 58 },
];

export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if categories already exist
    const existing = await ctx.db.query("categories").first();
    if (existing) {
      return { success: false, message: "Categories already seeded" };
    }

    // Insert default categories
    for (const cat of DEFAULT_CATEGORIES) {
      await ctx.db.insert("categories", {
        ...cat,
        isSystem: true,
      });
    }

    return { success: true, message: `Seeded ${DEFAULT_CATEGORIES.length} categories` };
  },
});

export const seedCategorizationRules = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if rules already exist
    const existing = await ctx.db.query("categorizationRules").first();
    if (existing) {
      return { success: false, message: "Categorization rules already seeded" };
    }

    // Get all categories to map names to IDs
    const categories = await ctx.db.query("categories").collect();
    const categoryMap = new Map(categories.map(c => [c.name, c._id]));

    // Insert default rules
    let inserted = 0;
    for (const rule of DEFAULT_RULES) {
      const categoryId = categoryMap.get(rule.categoryName);
      if (categoryId) {
        await ctx.db.insert("categorizationRules", {
          pattern: rule.pattern,
          categoryId,
          priority: rule.priority,
          isActive: true,
          createdBy: "system",
          matchCount: 0,
        });
        inserted++;
      }
    }

    return { success: true, message: `Seeded ${inserted} categorization rules` };
  },
});

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Seed categories first
    const existingCat = await ctx.db.query("categories").first();
    if (!existingCat) {
      for (const cat of DEFAULT_CATEGORIES) {
        await ctx.db.insert("categories", {
          ...cat,
          isSystem: true,
        });
      }
    }

    // Get all categories to map names to IDs
    const categories = await ctx.db.query("categories").collect();
    const categoryMap = new Map(categories.map(c => [c.name, c._id]));

    // Seed rules
    const existingRule = await ctx.db.query("categorizationRules").first();
    if (!existingRule) {
      for (const rule of DEFAULT_RULES) {
        const categoryId = categoryMap.get(rule.categoryName);
        if (categoryId) {
          await ctx.db.insert("categorizationRules", {
            pattern: rule.pattern,
            categoryId,
            priority: rule.priority,
            isActive: true,
            createdBy: "system",
            matchCount: 0,
          });
        }
      }
    }

    return { success: true, message: "Seed completed" };
  },
});

export const checkSeedStatus = query({
  args: {},
  handler: async (ctx) => {
    const categoriesCount = (await ctx.db.query("categories").collect()).length;
    const rulesCount = (await ctx.db.query("categorizationRules").collect()).length;

    return {
      categoriesSeeded: categoriesCount > 0,
      categoriesCount,
      rulesSeeded: rulesCount > 0,
      rulesCount,
    };
  },
});

export const addLifeExpenseCategory = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if it already exists
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_name", (q) => q.eq("name", "Life Expense"))
      .first();

    if (existing) {
      return { success: false, message: "Life Expense category already exists" };
    }

    await ctx.db.insert("categories", {
      name: "Life Expense",
      type: "expense",
      isEssential: false,
      color: "#78909C",
      sortOrder: 27,
      isSystem: true,
    });

    return { success: true, message: "Life Expense category added" };
  },
});

export const addExpandedRules = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all categories to map names to IDs
    const categories = await ctx.db.query("categories").collect();
    const categoryMap = new Map(categories.map((c) => [c.name, c._id]));

    // Get existing rules to check for duplicates
    const existingRules = await ctx.db.query("categorizationRules").collect();
    const existingPatterns = new Set(existingRules.map((r) => r.pattern.toLowerCase()));

    // Combine default + expanded rules
    const allRules = [...DEFAULT_RULES, ...EXPANDED_RULES];

    let added = 0;
    let skipped = 0;

    for (const rule of allRules) {
      // Skip if pattern already exists (case-insensitive)
      if (existingPatterns.has(rule.pattern.toLowerCase())) {
        skipped++;
        continue;
      }

      const categoryId = categoryMap.get(rule.categoryName);
      if (categoryId) {
        await ctx.db.insert("categorizationRules", {
          pattern: rule.pattern,
          categoryId,
          priority: rule.priority,
          isActive: true,
          createdBy: "system",
          matchCount: 0,
        });
        existingPatterns.add(rule.pattern.toLowerCase());
        added++;
      }
    }

    return {
      success: true,
      added,
      skipped,
      total: allRules.length,
    };
  },
});
