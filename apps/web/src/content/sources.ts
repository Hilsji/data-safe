/**
 * Quellenverzeichnis. Grundlage: Arbeitspapier „Vom 30-Sekunden-Video zur Pornosucht?“ (Stand 29.09.2026),
 * docs/quellen/Kurzvideo_Filterblasen_OnlyFans_Analyse.docx, Literaturverzeichnis.
 * `inPaper: false` = nicht im Arbeitspapier, zusätzlich geprüft (Weg in `verifiedVia`).
 */
export interface Source {
  id: string;
  short: string;
  year: number;
  citation: string;
  url?: string;
  doi?: string;
  /** Evidenzgrad laut Arbeitspapier (A–D) */
  grade?: "A" | "A–B" | "B" | "C" | "D";
  inPaper: boolean;
  verifiedVia?: string;
}

export const SOURCES = {
  jim2025: {
    id: "jim2025",
    short: "JIM-Studie 2025 (mpfs)",
    year: 2025,
    citation: "Medienpädagogischer Forschungsverbund Südwest (mpfs). (2025). JIM-Studie 2025: Jugend, Information, Medien.",
    url: "https://mpfs.de/studie/jim-studie-2025/",
    grade: "B",
    inPaper: true,
  },
  dak2026: {
    id: "dak2026",
    short: "DAK/UKE-Mediensuchtstudie 2025/26",
    year: 2026,
    citation:
      "DAK-Gesundheit. (2026). DAK-Suchtstudie untersucht Jugendtrend: KI-Chatbots erhöhen riskanten Medienkonsum [Pressemitteilung mit Ergebnisbericht 2025/2026].",
    url: "https://www.dak.de/presse/bundesthemen/kinder-jugendgesundheit/dak-suchtstudie-untersucht-jugendtrend-ki-chatbots-erhoehen-riskanten-medienkonsum_164470",
    grade: "B",
    inPaper: true,
  },
  hbsc2024: {
    id: "hbsc2024",
    short: "HBSC 2021/22 (WHO Europa)",
    year: 2024,
    citation: "WHO Regional Office for Europe. (2024). Teens, screens and mental health (HBSC 2021/22; Boniel-Nissim et al.).",
    url: "https://www.who.int/europe/news/item/25-09-2024-teens--screens-and-mental-health",
    grade: "B",
    inPaper: true,
  },
  cloes2026: {
    id: "cloes2026",
    short: "Cloes et al. 2026 (Preprint)",
    year: 2026,
    citation:
      "Cloes, J.-O., Klamert, L., Busch, K., & Paschke, K. (2026). Depression precedes problematic video streaming in adolescents [Preprint, medRxiv].",
    doi: "10.64898/2026.07.30.26359312",
    grade: "A–B",
    inPaper: true,
  },
  dcu2024: {
    id: "dcu2024",
    short: "Baker, Ging & Andreasen 2024 (DCU)",
    year: 2024,
    citation:
      "Baker, C., Ging, D., & Andreasen, M. B. (2024). Recommending toxicity: The role of algorithmic recommender functions on YouTube Shorts and TikTok in promoting male supremacist influencers. DCU Anti-Bullying Centre.",
    url: "https://www.dcu.ie/antibullyingcentre/recommending-toxicity",
    grade: "B",
    inPaper: true,
  },
  wsj2024: {
    id: "wsj2024",
    short: "WSJ & Edelson 2024",
    year: 2024,
    citation: "Wall Street Journal & Edelson, L. (2024). Testreihe zu Instagram Reels und Teen-Accounts, berichtet u. a. von MediaPost (21.06.2024).",
    url: "https://www.mediapost.com/publications/article/397055/teens-receiving-recommendations-for-sexual-video-c.html",
    grade: "B",
    inPaper: true,
  },
  amnesty2023: {
    id: "amnesty2023",
    short: "Amnesty International 2023",
    year: 2023,
    citation: "Amnesty International. (2023). Driven into darkness: How TikTok’s ‘For You’ feed encourages self-harm and suicidal ideation.",
    url: "https://www.amnesty.org/en/documents/pol40/7350/2023/en/",
    grade: "B",
    inPaper: true,
  },
  potsdam2025: {
    id: "potsdam2025",
    short: "Bertelsmann Stiftung & Uni Potsdam 2025",
    year: 2025,
    citation:
      "Bertelsmann Stiftung & Universität Potsdam. (2025). Digitalisiert, politisiert, polarisiert? Eine Analyse von Social-Media-Feeds junger Menschen zur Bundestagswahl 2025.",
    url: "https://www.bertelsmann-stiftung.de/de/unsere-projekte/engagement-junger-menschen-fuer-demokratie/projektnachrichten/algorithmen-im-wahlkampf",
    grade: "B",
    inPaper: true,
  },
  hosseinmardi2024: {
    id: "hosseinmardi2024",
    short: "Hosseinmardi et al. 2024 (PNAS)",
    year: 2024,
    citation:
      "Hosseinmardi, H., et al. (2024). Causally estimating the effect of YouTube’s recommender system using counterfactual bots. PNAS, 121(8), e2313377121.",
    doi: "10.1073/pnas.2313377121",
    grade: "A",
    inPaper: true,
  },
  gauthier2026: {
    id: "gauthier2026",
    short: "Gauthier et al. 2026 (Nature)",
    year: 2026,
    citation: "Gauthier, G., Hodler, R., Widmer, P., & Zhuravskaya, E. (2026). The political effects of X’s feed algorithm. Nature, 652, 416–423.",
    doi: "10.1038/s41586-026-10098-2",
    grade: "A",
    inPaper: true,
  },
  piccardi2025: {
    id: "piccardi2025",
    short: "Piccardi et al. 2025 (Science)",
    year: 2025,
    citation:
      "Piccardi, T., et al. (2025). Reranking partisan animosity in algorithmic social media feeds alters affective polarization. Science, 390(6776), eadu5584.",
    doi: "10.1126/science.adu5584",
    grade: "A",
    inPaper: true,
  },
  castelo2025: {
    id: "castelo2025",
    short: "Castelo et al. 2025 (PNAS Nexus)",
    year: 2025,
    citation:
      "Castelo, N., Kushlev, K., Ward, A. F., Esterman, M., & Reiner, P. B. (2025). Blocking mobile internet on smartphones improves sustained attention, mental health, and subjective well-being. PNAS Nexus, 4, pgaf017.",
    grade: "A",
    inPaper: true,
  },
  euCommission2026: {
    id: "euCommission2026",
    short: "Europäische Kommission 2026",
    year: 2026,
    citation:
      "Europäische Kommission. (2026, 6. Februar). Commission preliminarily finds TikTok’s addictive design in breach of the Digital Services Act.",
    url: "https://digital-strategy.ec.europa.eu/en/news/commission-preliminarily-finds-tiktoks-addictive-design-breach-digital-services-act",
    grade: "C",
    inPaper: true,
  },
  tiktokDsa2023: {
    id: "tiktokDsa2023",
    short: "TikTok 2023 (DSA)",
    year: 2023,
    citation: "TikTok. (2023). Unsere Einhaltung des Digital Services Act.",
    url: "https://newsroom.tiktok.com/unsere-einhaltung-des-digital-services-act?lang=de-DE",
    grade: "C",
    inPaper: true,
  },
  heise2026: {
    id: "heise2026",
    short: "heise online 2026 (OLG Bamberg)",
    year: 2026,
    citation: "heise online. (2026, 31. März). OLG Bamberg: TikTok schummelt bei DSA-Pflichten (Az. 3 UKl 5/25 e).",
    url: "https://www.heise.de/news/OLG-Bamberg-TikTok-schummelt-bei-DSA-Pflichten-11242574.html",
    grade: "C",
    inPaper: true,
  },
  grubbs2019: {
    id: "grubbs2019",
    short: "Grubbs et al. 2019",
    year: 2019,
    citation:
      "Grubbs, J. B., Perry, S. L., Wilt, J. A., & Reid, R. C. (2019). Pornography problems due to moral incongruence: An integrative model with a systematic review and meta-analysis. Archives of Sexual Behavior, 48(2), 397–415.",
    doi: "10.1007/s10508-018-1248-x",
    inPaper: true,
  },
  nguyen2025: {
    id: "nguyen2025",
    short: "Nguyen et al. 2025 (Psychological Bulletin)",
    year: 2025,
    citation:
      "Nguyen, L., Walters, J., Paul, S., Monreal Ijurco, S., Rainey, G. E., Parekh, N., Blair, G., & Darrah, M. (2025). Feeds, feelings, and focus: A systematic review and meta-analysis examining the cognitive and mental health correlates of short-form video use. Psychological Bulletin, 151(9), 1125–1146.",
    doi: "10.1037/bul0000498",
    inPaper: false,
    verifiedVia: "PubMed PMID 41231585 (abgerufen 29.09.2026)",
  },
  chiossi2023: {
    id: "chiossi2023",
    short: "Chiossi et al. 2023 (CHI)",
    year: 2023,
    citation:
      "TODO: vollständige Angabe prüfen – Chiossi, F., et al. (2023). Short-form videos degrade our capacity to retain intentions: Effect of context switching on prospective memory. CHI ’23.",
    inPaper: false,
  },
  hautus1995: {
    id: "hautus1995",
    short: "Hautus 1995",
    year: 1995,
    citation:
      "Hautus, M. J. (1995). Corrections for extreme proportions and their biasing effects on estimated values of d′. Behavior Research Methods, Instruments, & Computers, 27(1), 46–51.",
    inPaper: false,
    verifiedVia: "TODO: bibliografische Angabe vor Einsatz prüfen (Methodenquelle, keine Zahl in der App)",
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
