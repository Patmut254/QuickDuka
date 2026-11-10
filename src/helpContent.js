// Help Centre text (How to Use + FAQs), English and Swahili.
// Kept short on purpose: one line per topic, a few short steps, short answers.
// howToSteps order must match STEP_ICONS in components/FAQPage.jsx.

export const HELP = {
  en: {
    welcomeDesc:
      "Record sales, track debts and stock, and see your profit, from any phone or computer.",
    welcomeTip: "Record sales and expenses every day for accurate reports.",
    yourDataDesc:
      "Only you and the staff you add can see your records. We never share them.",
    faqCats: {
      plans: "Plans and payment",
      selling: "Sales and credits",
      stock: "Stock and purchases",
      account: "Account and data",
    },
    howToSteps: [
      {
        title: "Dashboard",
        desc: "Your shop at a glance.",
        points: [
          "This month's sales, purchases, expenses, losses and profit",
          "Your latest activity",
          "Supplier payments that are due",
          "A 6-month performance chart",
        ],
      },
      {
        title: "Recording Sales",
        desc: "Record what you sold.",
        points: [
          "Go to Sales and tap New Sale",
          "Tap items from the list, or search. Tap again to add one more",
          "Change the quantity or amount if needed",
          "Add the customer, phone and how they paid",
          "Tap Save Sale. Stock goes down by itself",
        ],
        tip: "Forgot an item? Tap + Item on that sale.",
      },
      {
        title: "Tracking Debts with Credits",
        desc: "Keep track of customers who owe you.",
        points: [
          "Go to Credits and tap New Credit",
          "Tap the items they took. Stock goes down by itself",
          "Add their name, phone and a due date",
          "When they pay, tap Record Payment. Part payments are fine",
          "Never paid? Tap Bad Debt to write it off",
        ],
      },
      {
        title: "Recording Purchases",
        desc: "Record stock you bought.",
        points: [
          "Open Stock/Purchases, then Purchase history",
          "Tap New Purchase: item, supplier, quantity and cost",
          "Or tap Restock on an item when goods arrive",
          "Stock goes up by itself",
        ],
      },
      {
        title: "Buying Stock on Credit",
        desc: "Owe a supplier? Track it here.",
        points: [
          "When recording a purchase, choose Not fully paid",
          "Enter what you paid and the date you promised",
          "The Dashboard shows DUE SOON and OVERDUE",
          "Tap Pay to pay in parts",
        ],
      },
      {
        title: "Logging Expenses",
        desc: "Costs that are not stock.",
        points: [
          "Rent, transport, electricity, airtime, salaries",
          "Go to Expenses and tap New Expense",
          "Pick a category, amount and date",
        ],
      },
      {
        title: "Recording Losses",
        desc: "Stock you lost.",
        points: [
          "Expired, stolen, damaged or wasted goods",
          "Go to Losses and tap Record Loss",
          "This keeps your profit accurate",
        ],
      },
      {
        title: "Stock Catalogue and Sizes",
        desc: "Your list of items and prices.",
        points: [
          "Add each item with its buying and selling price",
          "Different sizes? Add each size as its own item (Variant)",
          "Decimals like 0.5 are fine",
          "Stock updates by itself when you sell or buy",
        ],
      },
      {
        title: "Reports",
        desc: "See how your business is doing.",
        points: [
          "Choose Daily, Weekly, Monthly or Yearly",
          "See sales, costs and profit with charts",
          "Download a file of your records",
        ],
      },
      {
        title: "History",
        desc: "Every change is saved.",
        points: [
          "See what was added, edited or deleted",
          "Restore anything deleted by mistake",
        ],
      },
      {
        title: "Subscription Plans",
        desc: "Pick the plan that fits your shop.",
        points: [
          "Starter, KES 100/mo: one shop, owner only",
          "Growth, KES 250/mo: add staff logins",
          "Business, KES 700/mo: many branches",
          "Every plan starts with a 1-month free trial",
        ],
      },
    ],
    faqList: [
      // Plans and payment
      {
        cat: "plans",
        q: "What plans are there?",
        a: "Starter, KES 100/mo: one shop, owner only.\nGrowth, KES 250/mo: one shop with staff.\nBusiness, KES 700/mo: many branches and combined reports.\nEvery plan starts with a 1-month free trial.",
      },
      {
        cat: "plans",
        q: "How do I pay?",
        a: "Send the plan amount by M-Pesa to 0769 758 819.\nThen WhatsApp the M-Pesa message to the same number.\nWe activate your account as soon as we receive it.",
      },
      {
        cat: "plans",
        q: "What happens when my plan expires?",
        a: "Your account locks until you pay. You get 2 extra days, and your data is never deleted.",
      },
      {
        cat: "plans",
        q: "Can I add staff or branches?",
        a: "Staff: Growth and Business plans. Each person gets their own login.\nBranches: Business plan only.\nUpgrade anytime from your Profile.",
      },
      // Sales and credits
      {
        cat: "selling",
        q: "Can one customer buy many items at once?",
        a: "Yes. In New Sale, tap each item. The total shows at the bottom.\nForgot one? Tap + Item on that sale.",
      },
      {
        cat: "selling",
        q: "How do I track who owes me money?",
        a: "Use Credits. Record what they took, then tap Record Payment each time they pay. Part payments are fine.",
      },
      {
        cat: "selling",
        q: "Does a credit reduce my stock?",
        a: "Yes, right away. Delete the credit before any payment and the goods go back.",
      },
      {
        cat: "selling",
        q: "I recorded a payment by mistake, or a written-off customer now wants to pay.",
        a: "Open the credit and tap Edit. Remove or fix the payment, or tap Reopen debt.",
      },
      {
        cat: "selling",
        q: "Which payment methods can I record?",
        a: "Cash, M-Pesa, Till, Paybill, Pochi la Biashara, Send Money, Airtel Money and Card.",
      },
      {
        cat: "selling",
        q: "Can I add an old sale or expense?",
        a: "Yes. Tap the Date field and pick the day.\nEntries older than a week don't change today's stock unless you tick the box.",
      },
      {
        cat: "selling",
        q: "Why does it say my amount is outside the allowed price?",
        a: "Each item has a price or price range in Stock. Enter an amount within it, or change the price in Stock first.",
      },
      // Stock and purchases
      {
        cat: "stock",
        q: "Where are Purchases?",
        a: "In Stock/Purchases, under Purchase history.",
      },
      {
        cat: "stock",
        q: "How do I sell one product in different sizes?",
        a: "Add each size as its own item and put the size in Variant, for example Water 0.5 L.",
      },
      {
        cat: "stock",
        q: "Can I use fractions like 0.5 kg?",
        a: "Yes. Quantities like 0.5 or 0.375 work.",
      },
      {
        cat: "stock",
        q: "How do I record stock bought on credit?",
        a: "Choose Not fully paid when recording the purchase. Pay later with the Pay button.",
      },
      {
        cat: "stock",
        q: "Will I be reminded to pay suppliers?",
        a: "Yes, on your Dashboard: DUE SOON within 3 days, OVERDUE after. No SMS reminders.",
      },
      {
        cat: "stock",
        q: "Expenses or Losses?",
        a: "Expenses: planned costs like rent and transport.\nLosses: surprises like expired or stolen stock.",
      },
      // Account and data
      {
        cat: "account",
        q: "Can I log in with my phone number?",
        a: "Yes. Use your phone number or your email.",
      },
      {
        cat: "account",
        q: "How do I reset my password?",
        a: "Tap Forgot password on the login screen. We'll email you a reset link.",
      },
      {
        cat: "account",
        q: "Is my data safe?",
        a: "Yes. It's stored on Google Firebase and only your account can see it.",
      },
      {
        cat: "account",
        q: "Does it work offline?",
        a: "You need internet to save and sync your records.",
      },
      {
        cat: "account",
        q: "Can I call a customer from the app?",
        a: "Yes. Tap any saved phone number to call.",
      },
      {
        cat: "account",
        q: "Why can't I see some pages on my phone?",
        a: "Some accounts show certain pages only on a computer. Contact support to change this.",
      },
    ],
  },

  sw: {
    welcomeDesc:
      "Rekodi mauzo, fuatilia madeni na bidhaa, na uone faida yako, kutoka simu au kompyuta yoyote.",
    welcomeTip: "Rekodi mauzo na gharama kila siku ili upate ripoti sahihi.",
    yourDataDesc:
      "Ni wewe tu na wafanyakazi uliowaongeza mnaoweza kuona rekodi zako. Hatuzishiriki na mtu yeyote.",
    faqCats: {
      plans: "Mipango na malipo",
      selling: "Mauzo na mikopo",
      stock: "Bidhaa na manunuzi",
      account: "Akaunti na data",
    },
    howToSteps: [
      {
        title: "Dashibodi",
        desc: "Duka lako kwa haraka.",
        points: [
          "Mauzo, manunuzi, gharama, hasara na faida ya mwezi huu",
          "Shughuli zako za hivi karibuni",
          "Malipo ya wasambazaji yanayodaiwa",
          "Chati ya miezi 6",
        ],
      },
      {
        title: "Kurekodi Mauzo",
        desc: "Rekodi ulichouza.",
        points: [
          "Nenda Mauzo na uguse Mauzo Mapya",
          "Gusa bidhaa kwenye orodha, au tafuta. Gusa tena kuongeza moja",
          "Badilisha idadi au kiasi ukihitaji",
          "Ongeza mteja, simu na njia ya malipo",
          "Gusa Hifadhi Mauzo. Bidhaa hupungua zenyewe",
        ],
        tip: "Umesahau bidhaa? Gusa + Bidhaa kwenye mauzo hayo.",
      },
      {
        title: "Kufuatilia Madeni (Mikopo)",
        desc: "Fuatilia wateja wanaokudai.",
        points: [
          "Nenda Mikopo na uguse Mkopo Mpya",
          "Gusa bidhaa walizochukua. Bidhaa hupungua zenyewe",
          "Ongeza jina, simu na tarehe ya kulipa",
          "Wakilipa, gusa Rekodi Malipo. Malipo kidogo kidogo yanaruhusiwa",
          "Hawajalipa kabisa? Gusa Deni Baya",
        ],
      },
      {
        title: "Kurekodi Manunuzi",
        desc: "Rekodi bidhaa ulizonunua.",
        points: [
          "Fungua Bidhaa/Manunuzi, kisha Historia ya manunuzi",
          "Gusa Ununuzi Mpya: bidhaa, msambazaji, idadi na gharama",
          "Au gusa Ongeza Bidhaa Dukani bidhaa zikifika",
          "Bidhaa huongezeka zenyewe",
        ],
      },
      {
        title: "Kununua Bidhaa kwa Mkopo",
        desc: "Unadaiwa na msambazaji? Fuatilia hapa.",
        points: [
          "Unaporekodi ununuzi, chagua Sijamaliza kulipa (deni)",
          "Weka ulicholipa na tarehe uliyoahidi",
          "Dashibodi inaonyesha INAKARIBIA na IMECHELEWA",
          "Gusa Lipa kulipa kidogo kidogo",
        ],
      },
      {
        title: "Kurekodi Gharama",
        desc: "Gharama zisizo za bidhaa.",
        points: [
          "Kodi, usafiri, umeme, muda wa maongezi, mishahara",
          "Nenda Gharama na uguse Gharama Mpya",
          "Chagua aina, kiasi na tarehe",
        ],
      },
      {
        title: "Kurekodi Hasara",
        desc: "Bidhaa zilizopotea.",
        points: [
          "Zilizoharibika, kuibwa, kuvunjika au kupotea",
          "Nenda Hasara na uguse Rekodi Hasara",
          "Hii huweka faida yako sahihi",
        ],
      },
      {
        title: "Orodha ya Bidhaa na Saizi",
        desc: "Orodha ya bidhaa zako na bei.",
        points: [
          "Ongeza kila bidhaa na bei ya kununua na kuuza",
          "Saizi tofauti? Ongeza kila saizi kama bidhaa yake (Aina)",
          "Desimali kama 0.5 zinaruhusiwa",
          "Bidhaa hubadilika zenyewe unapouza au kununua",
        ],
      },
      {
        title: "Ripoti",
        desc: "Ona biashara yako inavyoendelea.",
        points: [
          "Chagua Kila siku, Kila wiki, Kila mwezi au Kila mwaka",
          "Ona mauzo, gharama na faida kwa chati",
          "Pakua faili ya rekodi zako",
        ],
      },
      {
        title: "Historia",
        desc: "Kila badiliko linahifadhiwa.",
        points: [
          "Ona kilichoongezwa, kuhaririwa au kufutwa",
          "Rejesha kitu kilichofutwa kwa makosa",
        ],
      },
      {
        title: "Mipango ya Usajili",
        desc: "Chagua mpango unaofaa duka lako.",
        points: [
          "Starter, KES 100/mwezi: duka moja, mmiliki tu",
          "Growth, KES 250/mwezi: ongeza wafanyakazi",
          "Business, KES 700/mwezi: matawi mengi",
          "Kila mpango unaanza na mwezi 1 wa bure",
        ],
      },
    ],
    faqList: [
      {
        cat: "plans",
        q: "Kuna mipango gani?",
        a: "Starter, KES 100/mwezi: duka moja, mmiliki tu.\nGrowth, KES 250/mwezi: duka moja na wafanyakazi.\nBusiness, KES 700/mwezi: matawi mengi na ripoti za pamoja.\nKila mpango unaanza na mwezi 1 wa bure.",
      },
      {
        cat: "plans",
        q: "Nalipaje?",
        a: "Tuma kiasi cha mpango kwa M-Pesa kwa 0769 758 819.\nKisha tuma ujumbe wa M-Pesa kwa WhatsApp kwa nambari hiyo hiyo.\nTutawasha akaunti yako mara tukiupokea.",
      },
      {
        cat: "plans",
        q: "Nini hutokea mpango wangu ukiisha?",
        a: "Akaunti hufungwa hadi ulipe. Unapata siku 2 za ziada, na data yako haifutwi kamwe.",
      },
      {
        cat: "plans",
        q: "Naweza kuongeza wafanyakazi au matawi?",
        a: "Wafanyakazi: mipango ya Growth na Business. Kila mmoja anapata akaunti yake.\nMatawi: mpango wa Business tu.\nPandisha mpango wakati wowote kwenye Wasifu.",
      },
      {
        cat: "selling",
        q: "Mteja mmoja anaweza kununua bidhaa nyingi kwa mara moja?",
        a: "Ndiyo. Kwenye Mauzo Mapya, gusa kila bidhaa. Jumla inaonekana chini.\nUmesahau moja? Gusa + Bidhaa kwenye mauzo hayo.",
      },
      {
        cat: "selling",
        q: "Nafuatiliaje wanaonidai?",
        a: "Tumia Mikopo. Rekodi walichochukua, kisha gusa Rekodi Malipo kila wanapolipa. Malipo kidogo kidogo yanaruhusiwa.",
      },
      {
        cat: "selling",
        q: "Mkopo unapunguza bidhaa zangu?",
        a: "Ndiyo, papo hapo. Ukifuta mkopo kabla ya malipo yoyote, bidhaa zinarudi.",
      },
      {
        cat: "selling",
        q: "Nimerekodi malipo kwa makosa, au mteja niliyemfuta sasa anataka kulipa.",
        a: "Fungua mkopo na uguse Hariri. Ondoa au rekebisha malipo, au gusa Fungua deni tena.",
      },
      {
        cat: "selling",
        q: "Njia gani za malipo naweza kurekodi?",
        a: "Pesa taslimu, M-Pesa, Till, Paybill, Pochi la Biashara, Tuma Pesa, Airtel Money na Kadi.",
      },
      {
        cat: "selling",
        q: "Naweza kuongeza mauzo au gharama ya zamani?",
        a: "Ndiyo. Gusa sehemu ya Tarehe na uchague siku.\nRekodi za zaidi ya wiki moja hazibadilishi bidhaa za leo usipoweka alama.",
      },
      {
        cat: "selling",
        q: "Kwa nini inasema kiasi changu kiko nje ya bei inayoruhusiwa?",
        a: "Kila bidhaa ina bei au kiwango cha bei kwenye Bidhaa. Weka kiasi ndani yake, au badilisha bei kwanza.",
      },
      {
        cat: "stock",
        q: "Manunuzi yako wapi?",
        a: "Kwenye Bidhaa/Manunuzi, chini ya Historia ya manunuzi.",
      },
      {
        cat: "stock",
        q: "Nauzaje bidhaa moja kwa saizi tofauti?",
        a: "Ongeza kila saizi kama bidhaa yake na uweke saizi kwenye Aina, kwa mfano Maji 0.5 L.",
      },
      {
        cat: "stock",
        q: "Naweza kutumia nusu kama kilo 0.5?",
        a: "Ndiyo. Idadi kama 0.5 au 0.375 zinafanya kazi.",
      },
      {
        cat: "stock",
        q: "Narekodije bidhaa nilizonunua kwa mkopo?",
        a: "Chagua Sijamaliza kulipa (deni) unaporekodi ununuzi. Lipa baadaye kwa kitufe cha Lipa.",
      },
      {
        cat: "stock",
        q: "Nitakumbushwa kulipa wasambazaji?",
        a: "Ndiyo, kwenye Dashibodi: INAKARIBIA ndani ya siku 3, IMECHELEWA baada ya hapo. Hakuna SMS.",
      },
      {
        cat: "stock",
        q: "Gharama au Hasara?",
        a: "Gharama: matumizi yaliyopangwa kama kodi na usafiri.\nHasara: mambo ya ghafla kama bidhaa kuharibika au kuibwa.",
      },
      {
        cat: "account",
        q: "Naweza kuingia kwa nambari ya simu?",
        a: "Ndiyo. Tumia nambari ya simu au barua pepe.",
      },
      {
        cat: "account",
        q: "Nabadilishaje nenosiri?",
        a: "Gusa Umesahau nenosiri kwenye skrini ya kuingia. Tutakutumia kiungo kwa barua pepe.",
      },
      {
        cat: "account",
        q: "Data yangu iko salama?",
        a: "Ndiyo. Imehifadhiwa kwenye Google Firebase na ni akaunti yako tu inayoweza kuiona.",
      },
      {
        cat: "account",
        q: "Inafanya kazi bila mtandao?",
        a: "Unahitaji mtandao kuhifadhi na kusawazisha rekodi zako.",
      },
      {
        cat: "account",
        q: "Naweza kumpigia mteja kutoka kwenye programu?",
        a: "Ndiyo. Gusa nambari yoyote ya simu iliyohifadhiwa.",
      },
      {
        cat: "account",
        q: "Kwa nini sioni baadhi ya kurasa kwenye simu?",
        a: "Akaunti zingine zinaonyesha kurasa fulani kwenye kompyuta tu. Wasiliana nasi kubadilisha hili.",
      },
    ],
  },
};
