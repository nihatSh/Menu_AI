// Demo data. In production this lives in PostgreSQL and the owner edits it
// from the dashboard. The shape below is the contract the whole app relies on.
//
// Photographs come from photos.json, sourced from Wikimedia Commons and
// checked by eye rather than by keyword - see scripts/find-photos.mjs and
// docs/PHOTO_CREDITS.md. They are placeholders for the demo; a real
// restaurant replaces them with pictures of its own food.
//
// A dish carries everything the AI needs to reason about it: nutrition for the
// fitness features, allergens for the safety filter, prepMinutes for honest
// wait times, temp/tags for the weather logic, and kidFriendly for kids mode.

import { dishPhotos } from "./photos.js";

const withPhotos = (menu) =>
  menu.map((d) => (dishPhotos[d.id] ? { ...d, photoUrl: dishPhotos[d.id] } : d));

const RESTAURANTS = [
  {
    slug: "sehrli-tendir",
    name: "Səhrli Təndir",
    tagline: { az: "Ənənəvi Azərbaycan mətbəxi", en: "Traditional Azerbaijani kitchen", ru: "Традиционная азербайджанская кухня" },
    cuisine: "Azerbaijani",
    city: "Baku",
    coords: { lat: 40.3777, lon: 49.892 },
    currency: "AZN",
    timeZone: "Asia/Baku",
    hours: { open: "09:00", close: "23:30" },
    tables: 12,
    // Monthly ceiling for AI spend. When reached, the AI waiter switches to
    // the offline recommender until the 1st of next month. Owner-editable later.
    aiBudgetUsd: 50,
    emoji: "🫓",
    // Deep pomegranate. Nar appears twice on this menu and is the defining
    // Azerbaijani fruit, so this is brand reasoning, not the default warm-craft
    // reach that taste-skill bans (brass/ochre/clay).
    theme: { accent: "#a3243f" },
    quiz: [
      { q: "What is the main grain in plov?", a: ["Rice", "Bulgur", "Couscous"], correct: 0 },
      { q: "Dolma is wrapped in what?", a: ["Grape leaves", "Bread", "Pastry"], correct: 0 },
      { q: "Which herb is essential in dovga?", a: ["Mint", "Rosemary", "Basil"], correct: 0 },
      { q: "Saj is a type of...", a: ["Cooking plate", "Dessert", "Drink"], correct: 0 },
    ],
    menu: [
      {
        id: "st-dovga", category: "Soup", emoji: "🥣", price: 6.5,
        name: { az: "Dovğa", en: "Dovga", ru: "Довга" },
        desc: { az: "Yoğurt, düyü və göyərti ilə isti şorba", en: "Warm yoghurt soup with rice and herbs", ru: "Тёплый йогуртовый суп с рисом и зеленью" },
        kcal: 210, protein: 9, carbs: 24, fat: 8,
        allergens: ["dairy"], diet: ["vegetarian", "halal"], spice: 0,
        prepMinutes: 8, temp: "hot", kidFriendly: true, available: true,
        tags: ["comfort", "light", "warm", "traditional", "quick"],
      },
      {
        id: "st-piti", category: "Soup", emoji: "🍲", price: 11,
        name: { az: "Piti", en: "Piti", ru: "Пити" },
        desc: { az: "Qoyun əti və noxud ilə saxsı qabda bişmiş", en: "Lamb and chickpea stew baked in a clay pot", ru: "Баранина с нутом, запечённая в глиняном горшочке" },
        kcal: 680, protein: 38, carbs: 42, fat: 38,
        allergens: [], diet: ["halal", "gluten-free"], spice: 1,
        prepMinutes: 25, temp: "hot", kidFriendly: false, available: true,
        tags: ["hearty", "comfort", "warm", "traditional", "protein"],
      },
      {
        id: "st-dolma", category: "Main", emoji: "🍃", price: 13,
        name: { az: "Yarpaq dolması", en: "Grape leaf dolma", ru: "Долма в виноградных листьях" },
        desc: { az: "Üzüm yarpağında qiymə və düyü, sarımsaqlı qatıqla", en: "Minced meat and rice in grape leaves, garlic yoghurt", ru: "Фарш с рисом в виноградных листьях, чесночный йогурт" },
        kcal: 540, protein: 27, carbs: 32, fat: 32,
        allergens: ["dairy"], diet: ["halal"], spice: 0,
        prepMinutes: 20, temp: "hot", kidFriendly: true, available: true,
        tags: ["traditional", "comfort", "shareable", "protein"],
      },
      {
        id: "st-plov", category: "Main", emoji: "🍚", price: 16,
        name: { az: "Şah plov", en: "Shah plov", ru: "Шах-плов" },
        desc: { az: "Lavaş qabığında quzu əti, düyü, quru meyvə", en: "Lamb, rice and dried fruit baked in a bread crust", ru: "Баранина, рис и сухофрукты в хлебной корочке" },
        kcal: 890, protein: 34, carbs: 96, fat: 40,
        allergens: ["gluten", "nuts"], diet: ["halal"], spice: 0,
        prepMinutes: 35, temp: "hot", kidFriendly: true, available: true,
        tags: ["hearty", "celebration", "shareable", "traditional"],
      },
      {
        id: "st-saj", category: "Grill", emoji: "🔥", price: 22,
        name: { az: "Quzu sacı", en: "Lamb saj", ru: "Баранина садж" },
        desc: { az: "Sac üstündə quzu əti, kartof, bibər", en: "Lamb, potato and pepper seared on a hot iron plate", ru: "Баранина, картофель и перец на горячем садже" },
        kcal: 980, protein: 52, carbs: 48, fat: 62,
        allergens: [], diet: ["halal", "gluten-free"], spice: 1,
        prepMinutes: 30, temp: "hot", kidFriendly: false, available: true,
        tags: ["hearty", "shareable", "protein", "celebration"],
      },
      {
        id: "st-lulya", category: "Grill", emoji: "🍢", price: 14,
        name: { az: "Lülə kabab", en: "Lula kebab", ru: "Люля-кебаб" },
        desc: { az: "Kömür üstündə qiymə kabab, soğan salatı ilə", en: "Charcoal minced-meat kebab with onion salad", ru: "Люля на углях с луковым салатом" },
        kcal: 610, protein: 44, carbs: 8, fat: 44,
        allergens: [], diet: ["halal", "gluten-free"], spice: 1,
        prepMinutes: 15, temp: "hot", kidFriendly: true, available: true,
        tags: ["protein", "post-workout", "quick", "traditional"],
      },
      {
        id: "st-tavuq", category: "Grill", emoji: "🍗", price: 12.5,
        name: { az: "Toyuq kababı", en: "Chicken kebab", ru: "Куриный кебаб" },
        desc: { az: "Marinadlanmış toyuq döş əti, limonla", en: "Marinated chicken breast skewers with lemon", ru: "Маринованная куриная грудка на шампуре с лимоном" },
        kcal: 420, protein: 52, carbs: 4, fat: 20,
        allergens: [], diet: ["halal", "gluten-free"], spice: 0,
        prepMinutes: 14, temp: "hot", kidFriendly: true, available: true,
        tags: ["protein", "light", "post-workout", "quick"],
      },
      {
        id: "st-kutab", category: "Starter", emoji: "🫓", price: 5,
        name: { az: "Göyərti qutabı", en: "Herb qutab", ru: "Кутабы с зеленью" },
        desc: { az: "Nazik xəmirdə göyərti, sumaq ilə", en: "Thin flatbread filled with herbs, served with sumac", ru: "Тонкая лепёшка с зеленью и сумахом" },
        kcal: 260, protein: 8, carbs: 36, fat: 10,
        allergens: ["gluten"], diet: ["vegetarian", "halal"], spice: 0,
        prepMinutes: 10, temp: "hot", kidFriendly: true, available: true,
        tags: ["light", "quick", "traditional", "shareable", "breakfast"],
      },
      {
        id: "st-badimjan", category: "Starter", emoji: "🍆", price: 7,
        name: { az: "Badımcan rulet", en: "Aubergine rolls", ru: "Рулетики из баклажана" },
        desc: { az: "Qoz və sarımsaq dolması ilə badımcan", en: "Aubergine rolled around walnut and garlic", ru: "Баклажан с грецким орехом и чесноком" },
        kcal: 290, protein: 6, carbs: 14, fat: 24,
        allergens: ["nuts"], diet: ["vegan", "halal", "gluten-free"], spice: 0,
        prepMinutes: 6, temp: "cold", kidFriendly: false, available: true,
        tags: ["light", "fresh", "cold", "quick", "shareable"],
      },
      {
        id: "st-choban", category: "Salad", emoji: "🥗", price: 6,
        name: { az: "Çoban salatı", en: "Shepherd salad", ru: "Пастуший салат" },
        desc: { az: "Pomidor, xiyar, soğan, nar turşusu", en: "Tomato, cucumber, onion, pomegranate dressing", ru: "Помидор, огурец, лук, гранатовая заправка" },
        kcal: 140, protein: 3, carbs: 12, fat: 9,
        allergens: [], diet: ["vegan", "halal", "gluten-free"], spice: 0,
        prepMinutes: 5, temp: "cold", kidFriendly: true, available: true,
        tags: ["light", "fresh", "cold", "quick"],
      },
      {
        id: "st-mangal", category: "Salad", emoji: "🫑", price: 8,
        name: { az: "Mangal salatı", en: "Mangal salad", ru: "Мангал салат" },
        desc: { az: "Kömürdə bişmiş bibər, pomidor, badımcan", en: "Charred pepper, tomato and aubergine", ru: "Печёные на углях перец, помидор, баклажан" },
        kcal: 180, protein: 4, carbs: 16, fat: 11,
        allergens: [], diet: ["vegan", "halal", "gluten-free"], spice: 1,
        prepMinutes: 8, temp: "cold", kidFriendly: false, available: true,
        tags: ["light", "fresh", "cold", "shareable"],
      },
      {
        id: "st-pakhlava", category: "Dessert", emoji: "🍯", price: 5.5,
        name: { az: "Paxlava", en: "Pakhlava", ru: "Пахлава" },
        desc: { az: "Qoz, şəkər və zəfəran şərbəti ilə", en: "Walnut layers with saffron syrup", ru: "Слои с грецким орехом и шафранным сиропом" },
        kcal: 380, protein: 6, carbs: 44, fat: 21,
        allergens: ["nuts", "gluten"], diet: ["vegetarian", "halal"], spice: 0,
        prepMinutes: 3, temp: "cold", kidFriendly: true, available: true,
        tags: ["sweet", "quick", "traditional"],
      },
      {
        id: "st-firni", category: "Dessert", emoji: "🍮", price: 4.5,
        name: { az: "Firni", en: "Firni", ru: "Фирни" },
        desc: { az: "Düyü unu, süd və darçın ilə yüngül desert", en: "Light rice-flour milk pudding with cinnamon", ru: "Лёгкий молочный пудинг с корицей" },
        kcal: 220, protein: 6, carbs: 34, fat: 7,
        allergens: ["dairy"], diet: ["vegetarian", "halal", "gluten-free"], spice: 0,
        prepMinutes: 3, temp: "cold", kidFriendly: true, available: true,
        tags: ["sweet", "light", "quick", "comfort"],
      },
      {
        id: "st-chay", category: "Drink", emoji: "🫖", price: 3,
        name: { az: "Armudu çay", en: "Pear-glass tea", ru: "Чай в армуду" },
        desc: { az: "Kəklikotu ilə dəmlənmiş qara çay", en: "Black tea brewed with thyme", ru: "Чёрный чай с чабрецом" },
        kcal: 5, protein: 0, carbs: 1, fat: 0,
        allergens: [], diet: ["vegan", "halal", "gluten-free"], spice: 0,
        prepMinutes: 4, temp: "hot", kidFriendly: true, available: true,
        tags: ["warm", "quick", "traditional"],
      },
      {
        id: "st-ayran", category: "Drink", emoji: "🥛", price: 3.5,
        name: { az: "Ayran", en: "Ayran", ru: "Айран" },
        desc: { az: "Soyuq duzlu qatıq içkisi", en: "Chilled salted yoghurt drink", ru: "Холодный солёный йогуртовый напиток" },
        kcal: 90, protein: 5, carbs: 7, fat: 4,
        allergens: ["dairy"], diet: ["vegetarian", "halal", "gluten-free"], spice: 0,
        prepMinutes: 2, temp: "cold", kidFriendly: true, available: true,
        tags: ["cold", "fresh", "quick"],
      },
      {
        id: "st-sherbet",
        category: "Drink", emoji: "🧊", price: 4,
        name: { az: "Nar şərbəti", en: "Pomegranate sherbet", ru: "Гранатовый шербет" },
        desc: { az: "Təzə nar suyu, buz və nanə", en: "Fresh pomegranate juice, ice and mint", ru: "Свежий гранатовый сок со льдом и мятой" },
        kcal: 130, protein: 1, carbs: 32, fat: 0,
        allergens: [], diet: ["vegan", "halal", "gluten-free"], spice: 0,
        prepMinutes: 3, temp: "cold", kidFriendly: true, available: true,
        tags: ["cold", "fresh", "sweet", "quick"],
      },
    ],
  },

  {
    slug: "iron-fork",
    name: "Iron Fork",
    tagline: { az: "İdmançılar üçün kafe", en: "Fuel bar for athletes", ru: "Кафе для спортсменов" },
    cuisine: "Healthy / high protein",
    city: "Baku",
    coords: { lat: 40.4093, lon: 49.8671 },
    currency: "AZN",
    timeZone: "Asia/Baku",
    hours: { open: "07:00", close: "22:00" },
    tables: 8,
    aiBudgetUsd: 50,
    emoji: "🏋️",
    // Sharp emerald - reads as performance, not as herbal/organic.
    theme: { accent: "#0f8f63" },
    quiz: [
      { q: "Roughly how many kcal are in 1g of protein?", a: ["4", "9", "7"], correct: 0 },
      { q: "Which one is a complete protein?", a: ["Eggs", "Rice", "Peanut butter"], correct: 0 },
      { q: "Best window to eat after training?", a: ["Within 2 hours", "After 8 hours", "Never"], correct: 0 },
      { q: "Which has the most protein per 100g?", a: ["Chicken breast", "Potato", "Apple"], correct: 0 },
    ],
    menu: [
      {
        id: "if-oats", category: "Breakfast", emoji: "🥣", price: 7,
        name: { az: "Protein sıyığı", en: "Protein oats", ru: "Протеиновая овсянка" },
        desc: { az: "Yulaf, zülal tozu, banan, fındıq yağı", en: "Oats, whey, banana and peanut butter", ru: "Овсянка, протеин, банан, арахисовая паста" },
        kcal: 520, protein: 34, carbs: 62, fat: 14,
        allergens: ["nuts", "dairy", "gluten"], diet: ["vegetarian"], spice: 0,
        prepMinutes: 6, temp: "hot", kidFriendly: true, available: true,
        tags: ["breakfast", "protein", "post-workout", "warm", "quick"],
      },
      {
        id: "if-eggs", category: "Breakfast", emoji: "🍳", price: 8.5,
        name: { az: "Omlet və avokado", en: "Egg white omelette & avocado", ru: "Омлет из белков с авокадо" },
        desc: { az: "5 yumurta ağı, avokado, tam buğda çörəyi", en: "Five egg whites, avocado, wholegrain toast", ru: "Пять белков, авокадо, цельнозерновой тост" },
        kcal: 430, protein: 32, carbs: 30, fat: 20,
        allergens: ["eggs", "gluten"], diet: ["vegetarian"], spice: 0,
        prepMinutes: 9, temp: "hot", kidFriendly: true, available: true,
        tags: ["breakfast", "protein", "light", "warm"],
      },
      {
        id: "if-chicken-bowl", category: "Bowl", emoji: "🍱", price: 14,
        name: { az: "Toyuq və düyü kasası", en: "Chicken & rice bowl", ru: "Боул с курицей и рисом" },
        desc: { az: "200q toyuq döşü, qəhvəyi düyü, brokoli", en: "200g chicken breast, brown rice, broccoli", ru: "200 г курицы, бурый рис, брокколи" },
        kcal: 640, protein: 58, carbs: 64, fat: 14,
        allergens: [], diet: ["halal", "gluten-free"], spice: 0,
        prepMinutes: 12, temp: "hot", kidFriendly: true, available: true,
        tags: ["protein", "post-workout", "hearty", "warm"],
      },
      {
        id: "if-beef-bowl", category: "Bowl", emoji: "🥩", price: 18,
        name: { az: "Mal əti və şirin kartof", en: "Lean beef & sweet potato", ru: "Говядина со сладким картофелем" },
        desc: { az: "180q mal bifşteks, şirin kartof, ispanaq", en: "180g lean steak, sweet potato, spinach", ru: "180 г постного стейка, батат, шпинат" },
        kcal: 720, protein: 56, carbs: 52, fat: 28,
        allergens: [], diet: ["halal", "gluten-free"], spice: 0,
        prepMinutes: 18, temp: "hot", kidFriendly: false, available: true,
        tags: ["protein", "hearty", "post-workout", "warm"],
      },
      {
        id: "if-salmon", category: "Bowl", emoji: "🐟", price: 21,
        name: { az: "Qızılbalıq və kinoa", en: "Salmon & quinoa", ru: "Лосось с киноа" },
        desc: { az: "Fırında qızılbalıq, kinoa, yaşıl lobya", en: "Baked salmon, quinoa, green beans", ru: "Запечённый лосось, киноа, стручковая фасоль" },
        kcal: 610, protein: 46, carbs: 44, fat: 26,
        allergens: ["fish"], diet: ["gluten-free"], spice: 0,
        prepMinutes: 20, temp: "hot", kidFriendly: false, available: true,
        tags: ["protein", "light", "fresh", "warm"],
      },
      {
        id: "if-tofu", category: "Bowl", emoji: "🌱", price: 12,
        name: { az: "Tofu və noxud kasası", en: "Tofu & chickpea bowl", ru: "Боул с тофу и нутом" },
        desc: { az: "Ədviyyatlı tofu, noxud, kinoa, tahini", en: "Spiced tofu, chickpeas, quinoa, tahini", ru: "Тофу со специями, нут, киноа, тахини" },
        kcal: 560, protein: 30, carbs: 58, fat: 22,
        allergens: ["soy", "sesame"], diet: ["vegan", "gluten-free"], spice: 1,
        prepMinutes: 11, temp: "hot", kidFriendly: false, available: true,
        tags: ["protein", "fresh", "warm", "light"],
      },
      {
        id: "if-caesar", category: "Salad", emoji: "🥗", price: 11,
        name: { az: "Yüngül Sezar", en: "Light Caesar", ru: "Лёгкий Цезарь" },
        desc: { az: "Toyuq, kahı, yüngül sous, parmesan", en: "Chicken, romaine, light dressing, parmesan", ru: "Курица, романо, лёгкий соус, пармезан" },
        kcal: 380, protein: 38, carbs: 12, fat: 20,
        allergens: ["dairy", "eggs"], diet: ["halal", "gluten-free"], spice: 0,
        prepMinutes: 7, temp: "cold", kidFriendly: true, available: true,
        tags: ["light", "protein", "cold", "fresh", "quick"],
      },
      {
        id: "if-greens", category: "Salad", emoji: "🥬", price: 8,
        name: { az: "Yaşıl detoks salatı", en: "Green detox salad", ru: "Зелёный детокс-салат" },
        desc: { az: "İspanaq, xiyar, avokado, limon", en: "Spinach, cucumber, avocado, lemon", ru: "Шпинат, огурец, авокадо, лимон" },
        kcal: 240, protein: 7, carbs: 16, fat: 17,
        allergens: [], diet: ["vegan", "gluten-free"], spice: 0,
        prepMinutes: 5, temp: "cold", kidFriendly: false, available: true,
        tags: ["light", "fresh", "cold", "quick"],
      },
      {
        id: "if-soup", category: "Soup", emoji: "🍜", price: 7.5,
        name: { az: "Mərci şorbası", en: "Red lentil soup", ru: "Суп из красной чечевицы" },
        desc: { az: "Mərci, zəncəfil, limon", en: "Lentils, ginger and lemon", ru: "Чечевица, имбирь, лимон" },
        kcal: 280, protein: 16, carbs: 40, fat: 5,
        allergens: [], diet: ["vegan", "gluten-free"], spice: 1,
        prepMinutes: 6, temp: "hot", kidFriendly: true, available: true,
        tags: ["warm", "comfort", "light", "quick"],
      },
      {
        id: "if-wrap", category: "Main", emoji: "🌯", price: 10,
        name: { az: "Toyuq rulet", en: "Chicken wrap", ru: "Ролл с курицей" },
        desc: { az: "Tam buğda lavaş, toyuq, yoğurt sousu", en: "Wholegrain wrap, chicken, yoghurt sauce", ru: "Цельнозерновая лепёшка, курица, йогуртовый соус" },
        kcal: 520, protein: 42, carbs: 46, fat: 16,
        allergens: ["gluten", "dairy"], diet: ["halal"], spice: 1,
        prepMinutes: 8, temp: "hot", kidFriendly: true, available: true,
        tags: ["protein", "quick", "post-workout", "warm"],
      },
      {
        id: "if-shake", category: "Drink", emoji: "🥤", price: 6,
        name: { az: "Zülal kokteyli", en: "Protein shake", ru: "Протеиновый коктейль" },
        desc: { az: "30q zülal, banan, badam südü", en: "30g whey, banana, almond milk", ru: "30 г протеина, банан, миндальное молоко" },
        kcal: 310, protein: 32, carbs: 34, fat: 5,
        allergens: ["dairy", "nuts"], diet: ["vegetarian", "gluten-free"], spice: 0,
        prepMinutes: 3, temp: "cold", kidFriendly: true, available: true,
        tags: ["protein", "post-workout", "cold", "quick", "sweet"],
      },
      {
        id: "if-green-juice", category: "Drink", emoji: "🧃", price: 5.5,
        name: { az: "Yaşıl şirə", en: "Green juice", ru: "Зелёный сок" },
        desc: { az: "Kərəviz, alma, xiyar, zəncəfil", en: "Celery, apple, cucumber, ginger", ru: "Сельдерей, яблоко, огурец, имбирь" },
        kcal: 120, protein: 2, carbs: 28, fat: 0,
        allergens: [], diet: ["vegan", "gluten-free"], spice: 0,
        prepMinutes: 4, temp: "cold", kidFriendly: true, available: true,
        tags: ["cold", "fresh", "light", "quick"],
      },
      {
        id: "if-americano", category: "Drink", emoji: "☕", price: 4,
        name: { az: "Americano", en: "Americano", ru: "Американо" },
        desc: { az: "İkiqat espresso, isti su", en: "Double espresso, hot water", ru: "Двойной эспрессо с горячей водой" },
        kcal: 5, protein: 0, carbs: 1, fat: 0,
        allergens: [], diet: ["vegan", "gluten-free"], spice: 0,
        prepMinutes: 3, temp: "hot", kidFriendly: false, available: true,
        tags: ["warm", "quick"],
      },
      {
        id: "if-brownie", category: "Dessert", emoji: "🍫", price: 6,
        name: { az: "Protein brauni", en: "Protein brownie", ru: "Протеиновый брауни" },
        desc: { az: "Şəkərsiz kakao brauni, 20q zülal", en: "Sugar-free cocoa brownie, 20g protein", ru: "Брауни без сахара, 20 г белка" },
        kcal: 260, protein: 20, carbs: 22, fat: 10,
        allergens: ["dairy", "eggs", "nuts"], diet: ["vegetarian"], spice: 0,
        prepMinutes: 2, temp: "cold", kidFriendly: true, available: true,
        tags: ["sweet", "protein", "quick"],
      },
      {
        id: "if-yogurt", category: "Dessert", emoji: "🍧", price: 5,
        name: { az: "Yunan qatığı və giləmeyvə", en: "Greek yoghurt & berries", ru: "Греческий йогурт с ягодами" },
        desc: { az: "Yağsız qatıq, giləmeyvə, bal", en: "Fat-free yoghurt, berries, honey", ru: "Обезжиренный йогурт, ягоды, мёд" },
        kcal: 210, protein: 22, carbs: 26, fat: 2,
        allergens: ["dairy"], diet: ["vegetarian", "gluten-free"], spice: 0,
        prepMinutes: 2, temp: "cold", kidFriendly: true, available: true,
        tags: ["sweet", "light", "protein", "cold", "quick"],
      },
    ],
  },
];

export const restaurants = RESTAURANTS.map((r) => ({ ...r, menu: withPhotos(r.menu) }));

export function getRestaurant(slug) {
  return restaurants.find((r) => r.slug === slug) || null;
}

export function getDish(slug, dishId) {
  const r = getRestaurant(slug);
  return r ? r.menu.find((d) => d.id === dishId) || null : null;
}

export const ALL_ALLERGENS = ["gluten", "dairy", "nuts", "eggs", "fish", "soy", "sesame"];
export const DIETS = ["halal", "vegetarian", "vegan", "gluten-free"];
