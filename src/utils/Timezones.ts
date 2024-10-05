export const TIMEZONES = [
    "ACDT", "ACST", "ADT", "AEDT", "AEST", "AFT", "AKDT", "AKST", "ALMT", "AMST",
    "AMT", "ANAST", "ANAT", "AQTT", "ART", "AST", "AWDT", "AWST", "AZOST", "AZOT",
    "AZST", "AZT", "BNT", "BOT", "BRST", "BRT", "BST", "BTT", "CAST", "CAT",
    "CCT", "CDT", "CEST", "CET", "CHADT", "CHAST", "CKT", "CLST", "CLT", "COT",
    "CST", "CT", "CVT", "CXT", "ChST", "DAVT", "EASST", "EAST", "EAT", "ECT",
    "EDT", "EEST", "EET", "EGST", "EGT", "EST", "ET", "FJST", "FJT", "FKST",
    "FKT", "FNT", "GALT", "GAMT", "GET", "GFT", "GILT", "GMT", "GST", "GYT",
    "HAA", "HAC", "HADT", "HAE", "HAP", "HAR", "HAST", "HAT", "HAY", "HKT",
    "HLV", "HNA", "HNC", "HNE", "HNP", "HNR", "HNT", "HNY", "HOVT", "ICT",
    "IDT", "IOT", "IRDT", "IRKST", "IRKT", "IRST", "IST", "JST", "KGT", "KRAST",
    "KRAT", "KST", "KUYT", "LHDT", "LHST", "LINT", "MAGST", "MAGT", "MART", "MAWT",
    "MDT", "MESZ", "MEZ", "MHT", "MMT", "MSD", "MSK", "MST", "MT", "MUT",
    "MVT", "MYT", "NCT", "NDT", "NFT", "NOVST", "NOVT", "NPT", "NST", "NUT",
    "NZDT", "NZST", "OMSST", "OMST", "PDT", "PET", "PETST", "PETT", "PGT", "PHOT",
    "PHT", "PKT", "PMDT", "PMST", "PONT", "PST", "PT", "PWT", "PYST", "PYT",
    "RET", "SAMT", "SAST", "SBT", "SCT", "SGT", "SRT", "SST", "TAHT", "TFT",
    "TJT", "TKT", "TLT", "TMT", "TVT", "ULAT", "UTC", "UYST", "UYT", "UZT",
    "VET", "VLAST", "VLAT", "VUT", "WAST", "WAT", "WEST", "WESZ", "WET", "WEZ",
    "WFT", "WGST", "WGT", "WIB", "WIT", "WITA", "WST", "WT", "YAKST", "YAKT",
    "YAPT", "YEKST", "YEKT"
];
export const GMT_TO_TIMEZONE = {
    "GMT+0": "GMT",
    "GMT+1": "CET",
    "GMT+2": "EET",
    "GMT+3": "MSK",
    "GMT+4": "AMT",
    "GMT+5": "PKT",
    "GMT+6": "OMSK",
    "GMT+7": "KRAT",
    "GMT+8": "CST",
    "GMT+9": "JST",
    "GMT+10": "AEST",
    "GMT+11": "SAKT",
    "GMT+12": "NZST",
    "GMT-1": "WAT",
    "GMT-2": "AT",
    "GMT-3": "ART",
    "GMT-4": "AST",
    "GMT-5": "EST",
    "GMT-6": "CST",
    "GMT-7": "MST",
    "GMT-8": "PST",
    "GMT-9": "AKST",
    "GMT-10": "HST",
    "GMT-11": "NT",
    "GMT-12": "IDLW",
};


export function getTimezone(input: string): string | false {
    if (input.length === 0) return "UTC";

    if (TIMEZONES.includes(input)) return input;
    if (GMT_TO_TIMEZONE[input as keyof typeof GMT_TO_TIMEZONE]) return GMT_TO_TIMEZONE[input as keyof typeof GMT_TO_TIMEZONE];
    return false;
}
