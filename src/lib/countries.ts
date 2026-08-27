/**
 * ISO 3166-1 alpha-2. Only the code is ever stored; this file is what turns one
 * into something a person can read.
 *
 * The names are a table rather than `Intl.DisplayNames`, which is the obvious
 * thing to reach for and is wrong here: the display names come from whichever
 * CLDR version the *runtime* was built against, so Node and the browser
 * disagree — measured, on this pair, for FK, HK, MO and PS. Any country name
 * rendered by a client component is therefore a hydration mismatch waiting for
 * somebody from Hong Kong to sign up. A table is boring and identical
 * everywhere, which is the entire requirement.
 *
 * English only, deliberately: these are one CLDR version's names, and mixing in
 * a second locale's would mean maintaining a matrix instead of a list.
 */
const CODES =
	"AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW";

const COUNTRY_CODES: readonly string[] = CODES.split(" ");

const CODE_SET = new Set(COUNTRY_CODES);

export function isCountryCode(value: unknown): value is string {
	return typeof value === "string" && CODE_SET.has(value.toUpperCase());
}

/**
 * A URL or form value narrowed to a country, or null. Case-insensitive,
 * because `?country=ro` is what somebody types.
 */
export function toCountryCode(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const code = value.trim().toUpperCase();
	return isCountryCode(code) ? code : null;
}

/**
 * `code=Name` pairs, from CLDR by way of Node's `Intl.DisplayNames`. Regenerate
 * wholesale rather than editing one entry, so the list stays one version.
 */
const NAMES =
	"AD=Andorra|AE=United Arab Emirates|AF=Afghanistan|" +
	"AG=Antigua & Barbuda|AI=Anguilla|AL=Albania|AM=Armenia|AO=Angola|" +
	"AQ=Antarctica|AR=Argentina|AS=American Samoa|AT=Austria|AU=Australia|" +
	"AW=Aruba|AX=Åland Islands|AZ=Azerbaijan|BA=Bosnia & Herzegovina|" +
	"BB=Barbados|BD=Bangladesh|BE=Belgium|BF=Burkina Faso|BG=Bulgaria|" +
	"BH=Bahrain|BI=Burundi|BJ=Benin|BL=St. Barthélemy|BM=Bermuda|" +
	"BN=Brunei|BO=Bolivia|BQ=Caribbean Netherlands|BR=Brazil|BS=Bahamas|" +
	"BT=Bhutan|BV=Bouvet Island|BW=Botswana|BY=Belarus|BZ=Belize|" +
	"CA=Canada|CC=Cocos (Keeling) Islands|CD=Congo - Kinshasa|" +
	"CF=Central African Republic|CG=Congo - Brazzaville|CH=Switzerland|" +
	"CI=Côte d’Ivoire|CK=Cook Islands|CL=Chile|CM=Cameroon|CN=China|" +
	"CO=Colombia|CR=Costa Rica|CU=Cuba|CV=Cape Verde|CW=Curaçao|" +
	"CX=Christmas Island|CY=Cyprus|CZ=Czechia|DE=Germany|DJ=Djibouti|" +
	"DK=Denmark|DM=Dominica|DO=Dominican Republic|DZ=Algeria|EC=Ecuador|" +
	"EE=Estonia|EG=Egypt|EH=Western Sahara|ER=Eritrea|ES=Spain|" +
	"ET=Ethiopia|FI=Finland|FJ=Fiji|FK=Falkland Islands|FM=Micronesia|" +
	"FO=Faroe Islands|FR=France|GA=Gabon|GB=United Kingdom|GD=Grenada|" +
	"GE=Georgia|GF=French Guiana|GG=Guernsey|GH=Ghana|GI=Gibraltar|" +
	"GL=Greenland|GM=Gambia|GN=Guinea|GP=Guadeloupe|GQ=Equatorial Guinea|" +
	"GR=Greece|GS=South Georgia & South Sandwich Islands|GT=Guatemala|" +
	"GU=Guam|GW=Guinea-Bissau|GY=Guyana|HK=Hong Kong SAR China|" +
	"HM=Heard & McDonald Islands|HN=Honduras|HR=Croatia|HT=Haiti|" +
	"HU=Hungary|ID=Indonesia|IE=Ireland|IL=Israel|IM=Isle of Man|IN=India|" +
	"IO=British Indian Ocean Territory|IQ=Iraq|IR=Iran|IS=Iceland|" +
	"IT=Italy|JE=Jersey|JM=Jamaica|JO=Jordan|JP=Japan|KE=Kenya|" +
	"KG=Kyrgyzstan|KH=Cambodia|KI=Kiribati|KM=Comoros|" +
	"KN=St. Kitts & Nevis|KP=North Korea|KR=South Korea|KW=Kuwait|" +
	"KY=Cayman Islands|KZ=Kazakhstan|LA=Laos|LB=Lebanon|LC=St. Lucia|" +
	"LI=Liechtenstein|LK=Sri Lanka|LR=Liberia|LS=Lesotho|LT=Lithuania|" +
	"LU=Luxembourg|LV=Latvia|LY=Libya|MA=Morocco|MC=Monaco|MD=Moldova|" +
	"ME=Montenegro|MF=St. Martin|MG=Madagascar|MH=Marshall Islands|" +
	"MK=North Macedonia|ML=Mali|MM=Myanmar (Burma)|MN=Mongolia|" +
	"MO=Macao SAR China|MP=Northern Mariana Islands|MQ=Martinique|" +
	"MR=Mauritania|MS=Montserrat|MT=Malta|MU=Mauritius|MV=Maldives|" +
	"MW=Malawi|MX=Mexico|MY=Malaysia|MZ=Mozambique|NA=Namibia|" +
	"NC=New Caledonia|NE=Niger|NF=Norfolk Island|NG=Nigeria|NI=Nicaragua|" +
	"NL=Netherlands|NO=Norway|NP=Nepal|NR=Nauru|NU=Niue|NZ=New Zealand|" +
	"OM=Oman|PA=Panama|PE=Peru|PF=French Polynesia|PG=Papua New Guinea|" +
	"PH=Philippines|PK=Pakistan|PL=Poland|PM=St. Pierre & Miquelon|" +
	"PN=Pitcairn Islands|PR=Puerto Rico|PS=Palestinian Territories|" +
	"PT=Portugal|PW=Palau|PY=Paraguay|QA=Qatar|RE=Réunion|RO=Romania|" +
	"RS=Serbia|RU=Russia|RW=Rwanda|SA=Saudi Arabia|SB=Solomon Islands|" +
	"SC=Seychelles|SD=Sudan|SE=Sweden|SG=Singapore|SH=St. Helena|" +
	"SI=Slovenia|SJ=Svalbard & Jan Mayen|SK=Slovakia|SL=Sierra Leone|" +
	"SM=San Marino|SN=Senegal|SO=Somalia|SR=Suriname|SS=South Sudan|" +
	"ST=São Tomé & Príncipe|SV=El Salvador|SX=Sint Maarten|SY=Syria|" +
	"SZ=Eswatini|TC=Turks & Caicos Islands|TD=Chad|" +
	"TF=French Southern Territories|TG=Togo|TH=Thailand|TJ=Tajikistan|" +
	"TK=Tokelau|TL=Timor-Leste|TM=Turkmenistan|TN=Tunisia|TO=Tonga|" +
	"TR=Türkiye|TT=Trinidad & Tobago|TV=Tuvalu|TW=Taiwan|TZ=Tanzania|" +
	"UA=Ukraine|UG=Uganda|UM=U.S. Outlying Islands|US=United States|" +
	"UY=Uruguay|UZ=Uzbekistan|VA=Vatican City|VC=St. Vincent & Grenadines|" +
	"VE=Venezuela|VG=British Virgin Islands|VI=U.S. Virgin Islands|" +
	"VN=Vietnam|VU=Vanuatu|WF=Wallis & Futuna|WS=Samoa|YE=Yemen|" +
	"YT=Mayotte|ZA=South Africa|ZM=Zambia|ZW=Zimbabwe";

const NAME_BY_CODE = new Map(
	NAMES.split("|").map((pair) => {
		const [code, name] = pair.split("=");
		return [code as string, name as string];
	}),
);

/** "RO" → "Romania". Falls back to the code for anything unlisted. */
export function countryName(code: string): string {
	const upper = code.toUpperCase();
	return NAME_BY_CODE.get(upper) ?? upper;
}

/**
 * Flags are rendered by `<Flag>` from the `flag-icons` SVGs, not from
 * regional-indicator emoji: Windows has no flag glyphs, so the emoji form shows
 * up there as the bare letters "RO".
 */

/** Sorted for a picker: name order, not code order. */
export function countryOptions(): { code: string; name: string }[] {
	return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort(
		(a, b) => a.name.localeCompare(b.name),
	);
}

/**
 * A locale is not a country, but when it carries a region subtag it is the best
 * hint an OAuth profile gives us: `pt-BR` → BR, `en-US` → US, plain `ro` → null.
 */
export function countryFromLocale(
	locale: string | null | undefined,
): string | null {
	if (!locale) return null;
	const region = locale.replace("_", "-").split("-")[1]?.toUpperCase();
	return region && CODE_SET.has(region) ? region : null;
}
